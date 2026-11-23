import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';
import { EstadoPedido, PEDIDOS_ABIERTOS, pendientePedido, sugeridoPorEspiral } from '../common/reposicion';
import { diferenciaContador, sugeridoMateriaPrima, vendidasPorEspiral } from '../common/contadores';
import { baseEspirales, ultimasLecturas } from '../common/ultimas-lecturas';

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
        if (dto.nrEfectivoActual != null && dto.nrProductoActual == null) {
          throw new BadRequestException('La lectura NR producto es obligatoria');
        }
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
        const nrProductoActual = dto.nrProductoActual == null ? null : BigInt(dto.nrProductoActual);
        const ventaNr = calcular('NR efectivo', lecturas.nrEfectivo, nrActual);
        const unidadesNrProducto = nrProductoActual == null ? null : calcular('NR producto', lecturas.nrProducto, nrProductoActual);
        const visita = await tx.visitas.create({
          data: {
            idMaquina: dto.idMaquina, idOperador: dto.idOperador, idCliente: maquina.idCliente,
            fechaVisita, idOffline: dto.idOffline, idUsuarioRegistro: userId ?? null,
            nrEfectivoAnterior: lecturas.nrEfectivo, nrEfectivoActual: nrActual,
            nrProductoAnterior: nrProductoActual == null ? null : lecturas.nrProducto,
            nrProductoActual, ventaNr, reinicioContador: dto.reinicioContador ?? false,
          },
        });
        const idGrupo = visita.idVisita;
        await tx.maquinasYTiendas.update({
          where: { idMaquina: dto.idMaquina },
          data: { fechaUltimaVisita: fechaVisita, ultimoContadorNR: nrActual,
            ultimoContadorNRProducto: nrProductoActual ?? undefined },
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
        let ventaTeorica = new Prisma.Decimal(0);
        let valorFacturar = new Prisma.Decimal(0);
        let vendidasEspirales = 0;
        let faltanDatos = false;
        let faltanUnidades = false;
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
          if (mapa.producto.tipoProducto === 'MATERIA_PRIMA') continue;
          const anterior = anteriorPorEspiral.get(mapa.idMapaMp);
          const comparable = anterior?.idProducto === item.idProducto;
          const precio = precioPorProducto.get(item.idProducto);
          const vendidas = comparable
            ? vendidasPorEspiral(anterior.fisicoDigitado, anterior.despachado, item.fisicoDigitado)
            : null;
          if (vendidas == null) faltanUnidades = true;
          else vendidasEspirales += vendidas;
          if (vendidas == null || precio == null) faltanDatos = true;
          const subtotal = vendidas == null || precio == null ? null : precio.mul(vendidas);
          if (subtotal != null) {
            if (mapa.precioCero) {
              if (vendidas! >= 0) valorFacturar = valorFacturar.plus(subtotal);
            } else ventaTeorica = ventaTeorica.plus(subtotal);
          }
          detalleControles.push({ idMapaMp: mapa.idMapaMp, espiral: mapa.espiralCodigo,
            idProducto: item.idProducto, fisico: item.fisicoDigitado, vendidas, precioCero: mapa.precioCero,
            precio: precio?.toString() ?? null, subtotal: subtotal?.toString() ?? null,
            inconsistencia: vendidas == null ? 'SIN_BASE_COMPARABLE' : vendidas < 0 ? 'UNIDADES_NEGATIVAS'
              : precio == null ? 'SIN_PRECIO_CLIENTE' : null });
        }

        const mpConsolidado = new Map<number, { consumo: Prisma.Decimal; equivalencia: Prisma.Decimal; idMapaMp: number }>();
        const anteriorNrq = new Map(lecturas.botones.map(b => [b.idMapaNrq, b.lectura]));
        const nrqEntradas = dto.nrqLecturas?.map(b => ({ idMapaNRQ: b.idMapaNRQ, lectura: BigInt(b.lecturaActual) }))
          ?? dto.nrqItems?.map(b => ({ idMapaNRQ: b.idMapaNRQ, lectura: (anteriorNrq.get(b.idMapaNRQ) ?? 0n) + BigInt(b.valor) })) ?? [];
        const botonesProcesados = new Set<number>();

        for (const nrqItem of nrqEntradas) {
          const nrq = mapaNrqById.get(nrqItem.idMapaNRQ);
          if (!nrq || nrq.idMaquina !== dto.idMaquina) {
            throw new BadRequestException(`Mapa NRQ ${nrqItem.idMapaNRQ} no pertenece a la máquina`);
          }
          if (botonesProcesados.has(nrq.idMapaNrq)) throw new BadRequestException('Hay una lectura NRQ repetida');
          botonesProcesados.add(nrq.idMapaNrq);
          const anterior = anteriorNrq.get(nrq.idMapaNrq) ?? nrq.lecturaInicial;
          const unidades = calcular(`Botón ${nrq.opcionBoton}`, anterior, nrqItem.lectura);
          const idProdTerm = nrq.idProdTerm;
          const precio = precioPorProducto.get(idProdTerm);
          await tx.lecturasNrq.create({ data: {
            idVisita: idGrupo, idMapaNrq: nrq.idMapaNrq, idProdTerm, opcionBoton: nrq.opcionBoton,
            lecturaAnterior: anterior, lecturaActual: nrqItem.lectura, unidades,
            precioUnitario: precio, subtotal: precio?.mul(unidades.toString()),
          } });
          if (unidades === 0n) continue;
          const recetas = await tx.recetasDosificados.findMany({
            where: { idProdTerm },
            include: { materiaPrima: true },
          });
          if (recetas.length === 0) continue;

          for (const receta of recetas) {
            const mp = receta.materiaPrima;
            if (!mp) continue;
            const consumo = receta.cantidadDosis.mul(unidades.toString());
            const mapas = maquina.mapaMateriaPrima.filter((m) => m.idProducto === mp.idProducto);
            if (mapas.some(m => espiralesRegistrados.has(m.idMapaMp))) continue;
            if (mapas.length !== 1) throw new BadRequestException(`Configura un espiral para la materia prima ${mp.idProducto}`);

            const anterior = mpConsolidado.get(mp.idProducto);
            if (anterior) {
              anterior.consumo = anterior.consumo.plus(consumo);
            } else {
              mpConsolidado.set(mp.idProducto, {
                consumo, equivalencia: mp.equivalencia,
                idMapaMp: mapas[0].idMapaMp,
              });
            }
          }
        }

        if (dto.nrEfectivoActual != null && botonesProcesados.size !== mapaNrqById.size) {
          throw new BadRequestException('Registra la lectura de cada botón configurado');
        }
        for (const [idProducto, { consumo, equivalencia, idMapaMp }] of mpConsolidado) {
          const mapa = mapaMpById.get(idMapaMp)!;
          if (equivalencia.lte(0)) throw new BadRequestException(`Equivalencia inválida para el producto ${idProducto}`);
          const sugerida = sugeridoMateriaPrima(consumo, equivalencia, mapa.capacidadMax);
          await crearPedido({
              idProducto,
              idMapaMp: mapa.idMapaMp,
              fisicoDigitado: mapa.capacidadMax - sugerida,
              cantSugerida: sugerida,
          });
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
        const controlCompleto = detalleControles.length > 0 && !faltanDatos && botonesProcesados.size === 0;

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
            unidadesNrProducto,
            ventaTeoricaProductos: detalleControles.length ? ventaTeorica : null,
            diferenciaVenta: controlCompleto ? new Prisma.Decimal(ventaNr.toString()).minus(ventaTeorica) : null,
            diferenciaUnidades: unidadesNrProducto != null && !faltanUnidades && detalleControles.length && !botonesProcesados.size
              ? unidadesNrProducto - BigInt(vendidasEspirales) : null,
            valorFacturarCliente: detalleControles.length ? valorFacturar : null,
            unidadesSugeridas: unidadesSugeridasVisita,
            detalle: { reposicion: detalleVisita, controles: detalleControles },
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
          mpDesdeRecetas: mpConsolidado.size,
        };
      },
      { timeout: 60000, maxWait: 30000 },
    );
  }
}
