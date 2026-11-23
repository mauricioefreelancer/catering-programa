import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';
import { EstadoPedido, PEDIDOS_ABIERTOS, pendientePedido, sugeridoPorEspiral } from '../common/reposicion';

@Injectable()
export class OperadorPedidoService {
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
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '${auditUid}', TRUE)`);

        // Marcar la máquina: última fecha de visita y guardar el nuevo contador NR (lectura acumulada)
        const fechaVisita = new Date();
        const visita = await tx.visitas.create({
          data: {
            idMaquina: dto.idMaquina, idOperador: dto.idOperador, idCliente: maquina.idCliente,
            fechaVisita, idOffline: dto.idOffline, idUsuarioRegistro: userId ?? null,
            nrEfectivoAnterior: maquina.ultimoContadorNR,
            nrEfectivoActual: dto.nrActual == null ? null : BigInt(dto.nrActual),
          },
        });
        const idGrupo = visita.idVisita;
        const updateMaquina: Prisma.MaquinasYTiendasUpdateInput = { fechaUltimaVisita: fechaVisita };
        if (dto.nrActual != null) {
          updateMaquina.ultimoContadorNR = BigInt(Math.round(dto.nrActual));
        }
        await tx.maquinasYTiendas.update({
          where: { idMaquina: dto.idMaquina },
          data: updateMaquina,
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
              nrActualMedido: dto.nrActual == null ? null : BigInt(dto.nrActual),
          });
        }

        const mpConsolidado = new Map<number, { mp: any; consumoUnidadConsumo: number; idMapaMp?: number; vendidasTotal: number }>();
        let totalNrqVendidas = 0;

        for (const nrqItem of dto.nrqItems ?? []) {
          const nrq = mapaNrqById.get(nrqItem.idMapaNRQ);
          if (!nrq || nrq.idMaquina !== dto.idMaquina) {
            throw new BadRequestException(`Mapa NRQ ${nrqItem.idMapaNRQ} no pertenece a la máquina`);
          }
          const idProdTerm = nrq.idProdTerm;
          const recetas = await tx.recetasDosificados.findMany({
            where: { idProdTerm },
            include: { materiaPrima: true },
          });
          const vendidas = Number(nrqItem.valor) || 0;
          totalNrqVendidas += vendidas;
          if (recetas.length === 0) continue;

          for (const receta of recetas) {
            const mp = receta.materiaPrima;
            if (!mp) continue;
            const dosisXUnidad = Number(receta.cantidadDosis) || 0;
            const consumoTotalUnidadConsumo = dosisXUnidad * vendidas;
            const mapas = maquina.mapaMateriaPrima.filter((m) => m.idProducto === mp.idProducto);
            if (vendidas === 0 || mapas.some(m => espiralesRegistrados.has(m.idMapaMp))) continue;
            if (mapas.length !== 1) throw new BadRequestException(`Configura un espiral para la materia prima ${mp.idProducto}`);

            const anterior = mpConsolidado.get(mp.idProducto);
            if (anterior) {
              anterior.consumoUnidadConsumo += consumoTotalUnidadConsumo;
              anterior.vendidasTotal += vendidas;
            } else {
              mpConsolidado.set(mp.idProducto, {
                mp,
                consumoUnidadConsumo: consumoTotalUnidadConsumo,
                idMapaMp: mapas[0].idMapaMp,
                vendidasTotal: vendidas,
              });
            }
          }
        }

        for (const [, data] of mpConsolidado) {
          const { mp, consumoUnidadConsumo, idMapaMp } = data;
          const equivalencia = Number(mp.equivalencia) || 1;
          const mapa = idMapaMp != null ? mapaMpById.get(idMapaMp) : undefined;
          if (!mapa) throw new BadRequestException(`Materia prima ${mp.idProducto} no está en el mapa`);
          const sugerida = Math.min(mapa.capacidadMax, Math.ceil(consumoUnidadConsumo / equivalencia));
          await crearPedido({
              idProducto: mp.idProducto,
              idMapaMp: mapa.idMapaMp,
              fisicoDigitado: mapa.capacidadMax - sugerida,
              cantSugerida: sugerida,
              nrqActualLectura: totalNrqVendidas ? BigInt(totalNrqVendidas) : null,
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
        const nrAnteriorVisita = maquina.ultimoContadorNR ? Number(maquina.ultimoContadorNR) : 0;
        const nrActualVisita = dto.nrActual != null ? Number(dto.nrActual) : 0;
        const totalVendidoVisita = Math.max(0, nrActualVisita - nrAnteriorVisita);

        await tx.ventasPorVisita.upsert({
          where: { idGrupo: idGrupo ?? 0 },
          create: {
            idGrupo,
            idMaquina: dto.idMaquina,
            idCliente: idClienteVisita,
            idOperador: dto.idOperador,
            fechaVisita,
            nrAnterior: BigInt(nrAnteriorVisita),
            nrActual: BigInt(nrActualVisita),
            totalVendido: new Prisma.Decimal(totalVendidoVisita),
            totalDespachado: new Prisma.Decimal(totalDespachadoVisita),
            // Total vendido por productos = Σ sugerido × precio (sin pendiente en el
            // momento del registro; el pendiente aparece al despachar y recién entonces
            // el "Vendido por Visita" recalcula restando lo que quedó pendiente).
            totalVendidoProductos: new Prisma.Decimal(totalDespachadoVisita),
            unidadesSugeridas: unidadesSugeridasVisita,
            detalle: detalleVisita,
            firmaOrigen: 'REGISTRO',
            firmaUsuario: userId ?? null,
          },
          update: {},
        });

        return {
          idGrupo,
          visita,
          totalCreados: pedidosCreados.length,
          pedidos: pedidosCreados,
          nrqItemsProcesados: dto.nrqItems?.length || 0,
          mpDesdeRecetas: mpConsolidado.size,
        };
      },
      { timeout: 60000, maxWait: 30000 },
    );
  }
}
