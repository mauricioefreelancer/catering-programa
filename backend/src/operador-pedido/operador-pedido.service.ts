import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';

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
    const maquina = await this.prisma.maquinasYTiendas.findUnique({
      where: { idMaquina: dto.idMaquina },
      include: {
        mapaMateriaPrima: { include: { producto: true } },
        mapaCafeNrq: { include: { productoTerminado: true } },
      },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    const operador = await this.prisma.operadores.findUnique({ where: { idOperador: dto.idOperador } });
    if (!operador) throw new NotFoundException('Operador no encontrado');

    // Se ejecuta toda la creación en una transacción para que, ante cualquier error,
    // no queden pedidos parciales de la misma visita (integridad del grupo).
    // Además se serializa la asignación del idGrupo con un bloqueo de asesoría a nivel
    // de transacción, evitando que dos operadores concurrentes obtengan el mismo grupo.
    return this.prisma.$transaction(
      async (tx) => {
        // Bloqueo de asesoría a nivel de transacción. La clave es un entero fijo que
        // representa la "secuencia global de grupos"; todos los creates pasan por aquí.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(446001230)`;

        // Contexto de auditoría dentro de la MISMA transacción (triggers PEDIDOS/MAQUINAS).
        const auditUid = userId ? String(userId) : '';
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '${auditUid}', TRUE)`);

        // Marcar la máquina: última fecha de visita y guardar el nuevo contador NR (lectura acumulada)
        const updateMaquina: any = { fechaUltimaVisita: new Date() };
        if (dto.nrActual != null) {
          updateMaquina.ultimoContadorNR = BigInt(Math.round(dto.nrActual));
        }
        await tx.maquinasYTiendas.update({
          where: { idMaquina: dto.idMaquina },
          data: updateMaquina,
        });

        const mapaMpById = new Map(maquina.mapaMateriaPrima.map((m) => [m.idMapaMp, m]));
        const mapaNrqById = new Map(maquina.mapaCafeNrq.map((m) => [m.idMapaNrq, m]));
        const pedidosCreados: any[] = [];

        // id de grupo (cabecera del pedido): secuencial INDEPENDIENTE de pedidos.
        // Se calcula con el máximo idGrupo existente (+1), no con max(idPedido),
        // para que la numeración de pedidos no colisione con los ids de las filas internas.
        const maxGrupo = await tx.pedidosOperador.aggregate({ _max: { idGrupo: true } });
        const idGrupo = (maxGrupo._max.idGrupo ?? 0) + 1;

        // Faltante pendiente de reposición por producto (mismo máquina): suma de lo que ya se
        // solicitó (pedidos PENDIENTE/PARCIAL) menos lo que bodega efectivamente despachó.
        // Sirve para NO volver a pedir en esta visita lo que sigue pendiente de despacho,
        // evitando el "falso faltante" cuando un pedido previo no se pudo reponer (stock 0 o
        // parcial) y el espiral sigue vacío sin que realmente se haya vendido.
        const pendientesPrevios = await tx.pedidosOperador.findMany({
          where: { idMaquina: dto.idMaquina, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          select: {
            idProducto: true,
            cantSugerida: true,
            despachosBodega: { select: { cantDespachada: true } },
          },
        });
        const pendienteSinDespacharById = new Map<number, number>();
        for (const prev of pendientesPrevios) {
          const despachado = prev.despachosBodega.reduce((acc: number, d) => acc + d.cantDespachada, 0);
          const falta = Math.max(0, prev.cantSugerida - despachado);
          if (falta > 0) {
            pendienteSinDespacharById.set(
              prev.idProducto,
              (pendienteSinDespacharById.get(prev.idProducto) ?? 0) + falta,
            );
          }
        }
        // Ajusta la cantidad sugerida descontando lo que ya está pedido sin despachar,
        // con piso en 0 para no generar sugerencias negativas.
        const ajustarSugerida = (idProducto: number, cantCalculada: number) =>
          Math.max(0, cantCalculada - (pendienteSinDespacharById.get(idProducto) ?? 0));

        for (const item of dto.items) {
          let capacidad = 0;
          let idMapaMpFinal: number | null = item.idMapaMP ?? null;
          let mpMatch: any = null;
          if (item.idMapaMP) {
            mpMatch = mapaMpById.get(item.idMapaMP);
            if (!mpMatch || mpMatch.idMaquina !== dto.idMaquina) {
              throw new BadRequestException(`Mapa MP ${item.idMapaMP} no pertenece a la máquina`);
            }
            if (mpMatch.idProducto !== item.idProducto) {
              throw new BadRequestException(`Mapa MP ${item.idMapaMP} no corresponde al producto ${item.idProducto}`);
            }
            capacidad = mpMatch.capacidadMax;
          } else {
            mpMatch = maquina.mapaMateriaPrima.find((m) => m.idProducto === item.idProducto);
            if (mpMatch) {
              capacidad = mpMatch.capacidadMax;
              idMapaMpFinal = mpMatch.idMapaMp;
            } else {
              capacidad = 500;
            }
          }
          if (capacidad < item.fisicoDigitado) {
            throw new BadRequestException(`Físico digitado ${item.fisicoDigitado} excede capacidad ${capacidad}`);
          }
          const cantSugerida = ajustarSugerida(item.idProducto, Math.max(0, capacidad - item.fisicoDigitado));
          const pedido = await tx.pedidosOperador.create({
            data: {
              idGrupo,
              idMaquina: dto.idMaquina,
              idOperador: dto.idOperador,
              idProducto: item.idProducto,
              idMapaMp: idMapaMpFinal,
              fisicoDigitado: item.fisicoDigitado,
              cantSugerida,
              nrActualMedido: dto.nrActual ? BigInt(dto.nrActual) : null,
              estado: 'PENDIENTE',
            },
          });
          pedidosCreados.push(pedido);
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
            const mpEnMapa = maquina.mapaMateriaPrima.find((m) => m.idProducto === mp.idProducto);

            const anterior = mpConsolidado.get(mp.idProducto);
            if (anterior) {
              anterior.consumoUnidadConsumo += consumoTotalUnidadConsumo;
              anterior.vendidasTotal += vendidas;
            } else {
              mpConsolidado.set(mp.idProducto, {
                mp,
                consumoUnidadConsumo: consumoTotalUnidadConsumo,
                idMapaMp: mpEnMapa?.idMapaMp,
                vendidasTotal: vendidas,
              });
            }
          }
        }

        for (const [, data] of mpConsolidado) {
          const { mp, consumoUnidadConsumo, idMapaMp } = data;
          const equivalencia = Number(mp.equivalencia) || 1;
          const capacidadUnidadesMapa = idMapaMp ? (mapaMpById.get(idMapaMp)?.capacidadMax ?? 0) : 0;
          const capacidadDotacionMaxUnidadConsumo =
            capacidadUnidadesMapa > 0 ? capacidadUnidadesMapa * equivalencia : equivalencia;

          const faltanteUnidadConsumo = Math.max(0, consumoUnidadConsumo);
          const cantSugeridaUnidadCompra = ajustarSugerida(
            mp.idProducto,
            Math.ceil(faltanteUnidadConsumo / equivalencia),
          );
          const fisicoEstimadoUnidadConsumo = Math.max(0, capacidadDotacionMaxUnidadConsumo - consumoUnidadConsumo);
          const fisicoDigitadoUnidadCompra = Math.round(fisicoEstimadoUnidadConsumo / equivalencia);

          const pedido = await tx.pedidosOperador.create({
            data: {
              idGrupo,
              idMaquina: dto.idMaquina,
              idOperador: dto.idOperador,
              idProducto: mp.idProducto,
              idMapaMp: idMapaMp ?? null,
              fisicoDigitado: fisicoDigitadoUnidadCompra,
              cantSugerida: cantSugeridaUnidadCompra,
              nrqActualLectura: totalNrqVendidas ? BigInt(totalNrqVendidas) : null,
              estado: 'PENDIENTE',
            },
          });
          pedidosCreados.push(pedido);
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
            fechaVisita: new Date(),
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
