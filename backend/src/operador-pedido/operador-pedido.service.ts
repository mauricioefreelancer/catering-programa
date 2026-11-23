import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';
import { EstadoPedido, PEDIDOS_ABIERTOS, pendientePedido, sugeridoPorEspiral } from '../common/reposicion';
import { diferenciaContador, vendidasPorEspiral } from '../common/contadores';
import { calcularConsumoMateriaPrima } from '../common/consumo-materia-prima';
import { baseEspirales, ultimasLecturas } from '../common/ultimas-lecturas';
import { calcularVentaTeorica, LineaVenta } from '../common/venta-teorica';

@Injectable()
export class OperadorPedidoService {
  private readonly logger = new Logger(OperadorPedidoService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { idOperador?: number; idMaquina?: number; estado?: string }) {
    const where: any = {};
    if (params?.idOperador) where.idOperador = Number(params.idOperador);
    if (params?.idMaquina) where.idMaquina = Number(params.idMaquina);
    if (params?.estado) where.estado = params.estado;
    return this.prisma.pedidosOperador.findMany({
      where,
      include: {
        maquina: { include: { cliente: true } },
        operador: true,
        producto: true,
        mapaMp: true,
        despachosBodega: { orderBy: { fechaHora: 'desc' } },
      },
      orderBy: { fechaHora: 'desc' },
      take: 500,
    });
  }

  async create(dto: CreatePedidoOperadorDto, userId?: number | null) {
    return this.prisma.$transaction(
      async (tx) => {
    await tx.$queryRaw`SELECT "ID_Maquina" FROM "MAQUINAS_Y_TIENDAS" WHERE "ID_Maquina" = ${dto.idMaquina} FOR UPDATE`;
    if (dto.idOffline) {
      const anterior = await tx.visitas.findUnique({
        where: { idOffline: dto.idOffline }, include: { pedidos: true },
      });
      if (anterior) {
        if (anterior.idMaquina !== dto.idMaquina || anterior.idOperador !== dto.idOperador) {
          throw new ConflictException('El identificador offline pertenece a otra visita');
        }
        return { idGrupo: anterior.idVisita, visita: anterior, totalCreados: anterior.pedidos.length, pedidos: anterior.pedidos };
      }
    }
    const maquina = await tx.maquinasYTiendas.findUnique({
      where: { idMaquina: dto.idMaquina },
      include: {
        mapaMateriaPrima: { include: { producto: true } },
        mapaCafeNrq: { include: { productoTerminado: true } },
      },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    const operador = await tx.operadores.findUnique({ where: { idOperador: dto.idOperador } });
    if (!operador) throw new NotFoundException('Operador no encontrado');

        // Contexto de auditoría dentro de la MISMA transacción (triggers PEDIDOS/MAQUINAS).
        const auditUid = userId ? String(userId) : '';
        await tx.$queryRaw`SELECT set_config('app.current_user_id', ${auditUid}, TRUE)`;

        // Marcar la máquina: última fecha de visita y guardar el nuevo contador NR (lectura acumulada)
        const lecturas = await ultimasLecturas(tx, dto.idMaquina);
        if (dto.ultimaVisitaId != null && dto.ultimaVisitaId !== (lecturas.visita?.idVisita ?? 0)) {
          throw new ConflictException('Ya hay otra visita registrada. Recarga las lecturas antes de confirmar.');
        }
        const fechaVisita = new Date(Math.max(Date.now(), (lecturas.visita?.fechaVisita.getTime() ?? 0) + 1));
        const efectivo = dto.nrEfectivoActual ?? dto.nrActual;
        if (efectivo == null) throw new BadRequestException('La lectura NR efectivo es obligatoria');
        if (dto.nrEfectivoActual == null || dto.nrqItems?.length) this.logger.warn('Registro con contadores del formato móvil anterior');
        const calcular = (nombre: string, anterior: bigint, actual: bigint) => {
          try {
            return diferenciaContador(anterior, actual, dto.reinicioContador === true);
          } catch (error) {
            if (error instanceof RangeError) throw new BadRequestException(`${nombre}: ${error.message}`);
            throw error;
          }
        };
        const nrActual = BigInt(efectivo);
        const ventaNr = calcular('NR efectivo', lecturas.nrEfectivo, nrActual);
        const visita = await tx.visitas.create({
          data: {
            idMaquina: dto.idMaquina, idOperador: dto.idOperador, idCliente: maquina.idCliente,
            fechaVisita, idOffline: dto.idOffline, idUsuarioRegistro: userId ?? null,
            nrEfectivoAnterior: lecturas.nrEfectivo, nrEfectivoActual: nrActual,
            ventaNr, reinicioContador: dto.reinicioContador ?? false, esCorteMes: dto.esCorteMes ?? false,
          },
        });
        const idGrupo = visita.idVisita;
        await tx.maquinasYTiendas.update({
          where: { idMaquina: dto.idMaquina },
          data: { fechaUltimaVisita: fechaVisita, ultimoContadorNR: nrActual },
        });

        const mapaMpById = new Map(maquina.mapaMateriaPrima.map((m) => [m.idMapaMp, m]));
        const mapaNrqById = new Map(maquina.mapaCafeNrq.map((m) => [m.idMapaNrq, m]));
        const pedidosCreados: Awaited<ReturnType<typeof tx.pedidosOperador.create>>[] = [];
        const espiralesRegistrados = new Set<number>();
        // Orden comun con bodega, incluso si la visita procesa los espirales en otro orden.
        await tx.$queryRaw`
          SELECT "ID_Pedido" FROM "PEDIDOS_OPERADOR" WHERE "ID_Maquina" = ${dto.idMaquina}
            AND "Estado" IN ('PENDIENTE', 'PARCIAL') ORDER BY "ID_Pedido" FOR UPDATE
        `;
        const precios = await tx.preciosCliente.findMany({
          where: { idCliente: maquina.idCliente ?? 0, idProducto: { in: [
            ...maquina.mapaMateriaPrima.map(m => m.idProducto), ...maquina.mapaCafeNrq.map(b => b.idProdTerm),
          ] } },
          select: { idProducto: true, precioVenta: true },
        });
        const precioPorProducto = new Map(precios.map(p => [p.idProducto, p.precioVenta]));
        const pedidosAnteriores = await baseEspirales(tx, lecturas.visita?.idVisita, fechaVisita);
        const anteriorPorEspiral = new Map(pedidosAnteriores.map(p => [p.idMapaMp, p]));
        const detalleControles: Prisma.InputJsonObject[] = [];
        const lineasVenta: LineaVenta[] = [];
        const crearPedido = async (data: Pick<Prisma.PedidosOperadorUncheckedCreateInput,
          'idProducto' | 'fisicoDigitado' | 'cantSugerida' | 'nrActualMedido' | 'nrqActualLectura'> & { idMapaMp: number }) => {
          if (espiralesRegistrados.has(data.idMapaMp)) throw new BadRequestException(`Espiral repetido: ${data.idMapaMp}`);
          espiralesRegistrados.add(data.idMapaMp);
          const anteriores = await tx.pedidosOperador.findMany({
            where: { idMaquina: dto.idMaquina, idMapaMp: data.idMapaMp, estado: { in: PEDIDOS_ABIERTOS } },
            include: { despachosBodega: { select: { cantDespachada: true } } },
            orderBy: [{ fechaHora: 'desc' }, { idPedido: 'desc' }],
          });
          let fechaFaltante: Date | null = null;
          let idPedidoReemplazado: number | null = null;
          for (const anterior of anteriores) {
            const despachado = anterior.despachosBodega.reduce((total, d) => total + d.cantDespachada, 0);
            const pendiente = pendientePedido(anterior.cantSugerida, despachado);
            if (anterior.idProducto === data.idProducto && pendiente > 0) {
              const origen = anterior.fechaFaltanteOriginal ?? anterior.fechaHora;
              if (!fechaFaltante || origen < fechaFaltante) fechaFaltante = origen;
            }
            idPedidoReemplazado ??= anterior.idPedido;
            await tx.pedidosOperador.update({
              where: { idPedido: anterior.idPedido },
              data: { estado: EstadoPedido.REEMPLAZADO, pendienteCongelado: pendiente },
            });
          }
          const pedido = await tx.pedidosOperador.create({
            data: {
              ...data, idGrupo, idMaquina: dto.idMaquina, idOperador: dto.idOperador, fechaHora: fechaVisita,
              estado: data.cantSugerida ? EstadoPedido.PENDIENTE : EstadoPedido.APROBADO,
              idPedidoReemplazado,
              fechaFaltanteOriginal: data.cantSugerida ? fechaFaltante ?? fechaVisita : null,
            },
          });
          pedidosCreados.push(pedido);
        };

        for (const item of dto.items) {
          const candidatos = maquina.mapaMateriaPrima.filter(m => m.idProducto === item.idProducto);
          const mapa = item.idMapaMP != null
            ? mapaMpById.get(item.idMapaMP)
            : candidatos.length === 1 ? candidatos[0] : null;
          if (!mapa || mapa.idProducto !== item.idProducto) {
            throw new BadRequestException(`Indica un espiral válido para el producto ${item.idProducto}`);
          }
          let cantSugerida: number;
          try {
            cantSugerida = sugeridoPorEspiral(mapa.capacidadMax, item.fisicoDigitado);
          } catch (error) {
            if (error instanceof RangeError) throw new BadRequestException(error.message);
            throw error;
          }
          await crearPedido({
              idProducto: item.idProducto,
              idMapaMp: mapa.idMapaMp,
              fisicoDigitado: item.fisicoDigitado,
              cantSugerida,
              nrActualMedido: nrActual,
          });
          if (mapa.producto.tipoProducto !== 'ESTANDAR') continue;
          const anterior = anteriorPorEspiral.get(mapa.idMapaMp);
          const comparable = anterior?.idProducto === item.idProducto;
          const precio = precioPorProducto.get(item.idProducto);
          const vendidas = comparable
            ? vendidasPorEspiral(anterior.fisicoDigitado, anterior.despachado, item.fisicoDigitado)
            : null;
          lineasVenta.push({ unidades: vendidas, precio: precio ?? null, porcentajeCliente: mapa.porcentajeCliente });
          detalleControles.push({ idMapaMp: mapa.idMapaMp, espiral: mapa.espiralCodigo,
            idProducto: item.idProducto, fisico: item.fisicoDigitado, vendidas,
            precio: precio?.toString() ?? null, porcentajeCliente: mapa.porcentajeCliente.toString() });
        }

        const tolvas = maquina.mapaMateriaPrima.filter(m => m.producto.tipoProducto === 'MATERIA_PRIMA');
        if (mapaNrqById.size && tolvas.some(t => !espiralesRegistrados.has(t.idMapaMp))) {
          throw new BadRequestException('Registra el físico de todas las tolvas configuradas');
        }
        const anteriorNrq = new Map(lecturas.botones.map(b => [b.idMapaNrq, b.lectura]));
        const nrqEntradas = dto.nrqLecturas?.map(b => ({ idMapaNRQ: b.idMapaNRQ, idMapaMP: b.idMapaMP, lectura: BigInt(b.lecturaActual) }))
          ?? dto.nrqItems?.map(b => ({ idMapaNRQ: b.idMapaNRQ, idMapaMP: undefined, lectura: (anteriorNrq.get(b.idMapaNRQ) ?? 0n) + BigInt(b.valor) })) ?? [];
        const exigeEspirales = maquina.tipoNegociacion === 'ESPECIAL'
          && (maquina.lecturaNrqEspiral === 'CADA_VISITA' || dto.esCorteMes === true);
        const previosEspiral = new Map(lecturas.nrqEspirales.map(l => [l.idMapaMp, l]));
        const nrqPorEspiral = new Map<number, bigint | null>();
        const botonesProcesados = new Set<number>();
        const unidadesCafe = new Map<number, bigint>();

        for (const nrqItem of nrqEntradas) {
          if ((nrqItem.idMapaNRQ == null) === (nrqItem.idMapaMP == null)) {
            throw new BadRequestException('Cada lectura NRQ debe indicar exactamente un botón o un espiral');
          }
          if (nrqItem.idMapaMP != null) {
            if (!exigeEspirales) {
              throw new BadRequestException('La visita no admite NRQ por espiral con la negociación y frecuencia configuradas');
            }
            const mapa = mapaMpById.get(nrqItem.idMapaMP);
            if (!mapa || mapa.producto.tipoProducto !== 'ESTANDAR' || !espiralesRegistrados.has(mapa.idMapaMp)) {
              throw new BadRequestException('Registra el físico del espiral estándar de la máquina antes de enviar su lectura NRQ');
            }
            if (nrqPorEspiral.has(mapa.idMapaMp)) throw new BadRequestException('Hay una lectura NRQ por espiral repetida');
            const previo = previosEspiral.get(mapa.idMapaMp);
            const anterior = previo?.lectura ?? mapa.lecturaInicial;
            const unidades = calcular(`Espiral ${mapa.espiralCodigo}`, anterior, nrqItem.lectura);
            const precio = precioPorProducto.get(mapa.idProducto);
            nrqPorEspiral.set(mapa.idMapaMp,
              previo?.idVisita != null && previo.idVisita === lecturas.visita?.idVisita &&
              previo.idProductoAnterior === mapa.idProducto ? unidades : null);
            await tx.lecturasNrq.create({ data: {
              idVisita: idGrupo, idMapaMp: mapa.idMapaMp, idProdTerm: mapa.idProducto, opcionBoton: mapa.espiralCodigo,
              lecturaAnterior: anterior, lecturaActual: nrqItem.lectura, unidades, precioUnitario: precio,
              subtotal: precio?.mul(unidades.toString()), porcentajeCliente: mapa.porcentajeCliente,
            } });
            continue;
          }
          const nrq = mapaNrqById.get(nrqItem.idMapaNRQ!);
          if (!nrq || nrq.idMaquina !== dto.idMaquina) {
            throw new BadRequestException(`Mapa NRQ ${nrqItem.idMapaNRQ} no pertenece a la máquina`);
          }
          if (botonesProcesados.has(nrq.idMapaNrq)) throw new BadRequestException('Hay una lectura NRQ repetida');
          botonesProcesados.add(nrq.idMapaNrq);
          const anterior = anteriorNrq.get(nrq.idMapaNrq) ?? nrq.lecturaInicial;
          const unidades = calcular(`Botón ${nrq.opcionBoton}`, anterior, nrqItem.lectura);
          const idProdTerm = nrq.idProdTerm;
          unidadesCafe.set(idProdTerm, (unidadesCafe.get(idProdTerm) ?? 0n) + unidades);
          const precio = precioPorProducto.get(idProdTerm);
          lineasVenta.push({ unidades, precio: precio ?? null, porcentajeCliente: nrq.porcentajeCliente });
          detalleControles.push({ idMapaNrq: nrq.idMapaNrq, boton: nrq.opcionBoton,
            idProducto: idProdTerm, vendidas: unidades.toString(),
            precio: precio?.toString() ?? null, porcentajeCliente: nrq.porcentajeCliente.toString() });
          await tx.lecturasNrq.create({ data: {
            idVisita: idGrupo, idMapaNrq: nrq.idMapaNrq, idProdTerm, opcionBoton: nrq.opcionBoton,
            lecturaAnterior: anterior, lecturaActual: nrqItem.lectura, unidades,
            precioUnitario: precio, subtotal: precio?.mul(unidades.toString()), porcentajeCliente: nrq.porcentajeCliente,
          } });
        }

        if (dto.nrEfectivoActual != null && botonesProcesados.size !== mapaNrqById.size) {
          throw new BadRequestException('Registra la lectura de cada botón configurado');
        }
        if (exigeEspirales && nrqPorEspiral.size !== previosEspiral.size) {
          throw new BadRequestException('Registra el NRQ de cada espiral estándar configurado');
        }
const controlesMP: Prisma.InputJsonObject[] = [];
        let diferenciaMpValor: Prisma.Decimal | null = null;
        if (mapaNrqById.size) {
          const recetas = await tx.recetasDosificados.findMany({
            where: { idProdTerm: { in: maquina.mapaCafeNrq.map(b => b.idProdTerm) } },
            include: { materiaPrima: true },
          });
          const productosMP = new Map([
            ...tolvas.map(t => [t.idProducto, t.producto] as const),
            ...recetas.map(r => [r.idMatPrima, r.materiaPrima] as const),
          ]);
          const fisicosActuales = new Map(pedidosCreados.map(p => [p.idMapaMp, p.fisicoDigitado]));
          let total = new Prisma.Decimal(0);
          let completo = productosMP.size > 0 && botonesProcesados.size === mapaNrqById.size;
          for (const [idProducto, mp] of productosMP) {
            const fisicos = tolvas.filter(t => t.idProducto === idProducto).map(t => {
              const anterior = anteriorPorEspiral.get(t.idMapaMp);
              return {
                idMapaMp: t.idMapaMp,
                fisicoAnterior: anterior?.idProducto === idProducto ? anterior.fisicoDigitado : null,
                despachado: anterior?.idProducto === idProducto ? anterior.despachado : 0,
                fisicoActual: fisicosActuales.get(t.idMapaMp)!,
              };
            });
            const dosis = recetas.filter(r => r.idMatPrima === idProducto).map(r => ({
              unidades: botonesProcesados.size === mapaNrqById.size ? unidadesCafe.get(r.idProdTerm) ?? null : null,
              cantidadDosis: r.cantidadDosis,
            }));
            const control = calcularConsumoMateriaPrima(dosis, fisicos, mp.equivalencia, mp.costoBase);
            if (control.valorDiferencia == null) completo = false;
            else total = total.plus(control.valorDiferencia);
            controlesMP.push({
              idProducto, nombre: mp.nombreProducto, unidadCompra: mp.unidadCompra, unidadConsumo: mp.unidadConsumo,
              equivalencia: mp.equivalencia.toString(), costoBase: mp.costoBase.toString(), tolvas: fisicos,
              consumoTeorico: control.consumoTeorico?.toString() ?? null, consumoReal: control.consumoReal?.toString() ?? null,
              diferencia: control.diferencia?.toString() ?? null, valorDiferencia: control.valorDiferencia?.toString() ?? null,
              inconsistencia: control.inconsistencia,
            });
          }
          if (completo) diferenciaMpValor = total.toDecimalPlaces(2);
        }

        // Persistir los totales de la visita (VENTAS_POR_VISITA) para que queden como
        // histórico inmutable. El total despachado = Σ cantidad sugerida x precio del
        // cliente (fallback a costo base). El total vendido = diferencia NR acumulada.
        const idClienteVisita = maquina.idCliente ?? null;
        const productosIds = [...new Set(pedidosCreados.map((p) => p.idProducto))];
        const preciosClienteMap = new Map<number, number>();
        if (idClienteVisita != null && productosIds.length) {
          const pc = await tx.preciosCliente.findMany({ where: { idCliente: idClienteVisita, idProducto: { in: productosIds } } });
          for (const item of pc) preciosClienteMap.set(item.idProducto, Number(item.precioVenta));
        }
        const costoBaseMap = new Map<number, number>();
        if (productosIds.length) {
          const prods = await tx.productos.findMany({ where: { idProducto: { in: productosIds } }, select: { idProducto: true, costoBase: true } });
          for (const pr of prods) costoBaseMap.set(pr.idProducto, Number(pr.costoBase));
        }
        let totalDespachadoVisita = 0;
        let unidadesSugeridasVisita = 0;
        const detalleVisita: any[] = [];
        for (const p of pedidosCreados) {
          const precio = preciosClienteMap.get(p.idProducto) ?? costoBaseMap.get(p.idProducto) ?? 0;
          const cantidad = Number(p.cantSugerida) || 0;
          totalDespachadoVisita += cantidad * precio;
          unidadesSugeridasVisita += cantidad;
          detalleVisita.push({ idProducto: p.idProducto, cantidad, precio, subtotal: cantidad * precio });
        }
        for (const mapa of maquina.mapaMateriaPrima) {
          if (mapa.producto.tipoProducto !== 'ESTANDAR' || espiralesRegistrados.has(mapa.idMapaMp)) continue;
          lineasVenta.push({ unidades: null, precio: precioPorProducto.get(mapa.idProducto) ?? null, porcentajeCliente: mapa.porcentajeCliente });
          detalleControles.push({ idMapaMp: mapa.idMapaMp, espiral: mapa.espiralCodigo, idProducto: mapa.idProducto,
            porcentajeCliente: mapa.porcentajeCliente.toString() });
        }
        for (const boton of maquina.mapaCafeNrq) {
          if (botonesProcesados.has(boton.idMapaNrq)) continue;
          lineasVenta.push({ unidades: null, precio: precioPorProducto.get(boton.idProdTerm) ?? null, porcentajeCliente: boton.porcentajeCliente });
          detalleControles.push({ idMapaNrq: boton.idMapaNrq, boton: boton.opcionBoton, idProducto: boton.idProdTerm,
            porcentajeCliente: boton.porcentajeCliente.toString() });
        }
        const { ventaTeorica, valorFacturarCliente, diferenciaVenta, controles } = calcularVentaTeorica(ventaNr, lineasVenta);
        const diferenciasEspiral = detalleControles.map(c => {
          const lectura = typeof c.idMapaMp === 'number' ? nrqPorEspiral.get(c.idMapaMp) : null;
          return lectura == null || typeof c.vendidas !== 'number' ? null : lectura - BigInt(c.vendidas);
        });
        const comparablesEspiral = diferenciasEspiral.filter((d): d is bigint => d != null);
        const diferenciaUnidades = comparablesEspiral.length && comparablesEspiral.length === nrqPorEspiral.size
          ? comparablesEspiral.reduce((total, d) => total + d, 0n) : null;

        await tx.ventasPorVisita.upsert({
          where: { idGrupo: idGrupo ?? 0 },
          create: {
            idGrupo,
            idMaquina: dto.idMaquina,
            idCliente: idClienteVisita,
            idOperador: dto.idOperador,
            fechaVisita,
            nrAnterior: lecturas.nrEfectivo,
            nrActual,
            totalVendido: new Prisma.Decimal(ventaNr.toString()),
            totalDespachado: new Prisma.Decimal(totalDespachadoVisita),
            totalVendidoProductos: ventaTeorica,
            ventaTeoricaProductos: detalleControles.length ? ventaTeorica : null,
            diferenciaVenta,
            diferenciaUnidades,
            diferenciaMpValor,
            valorFacturarCliente: detalleControles.length ? valorFacturarCliente : null,
            unidadesSugeridas: unidadesSugeridasVisita,
            detalle: { reposicion: detalleVisita, controlesMP, controles: detalleControles.map((linea, i) => ({
              ...linea, inconsistencia: controles[i].inconsistencia, subtotal: controles[i].subtotal?.toString() ?? null,
              cobrado: controles[i].cobrado?.toString() ?? null, facturable: controles[i].facturable?.toString() ?? null,
              diferenciaUnidades: diferenciasEspiral[i]?.toString() ?? null,
            })) },
            firmaOrigen: 'CONTADORES',
            firmaUsuario: userId ?? null,
          },
          update: {},
        });

        return {
          idGrupo,
          visita,
          totalCreados: pedidosCreados.length,
          pedidos: pedidosCreados,
          nrqItemsProcesados: botonesProcesados.size,
        };
      },
      { timeout: 60000, maxWait: 30000 },
    );
  }
}
