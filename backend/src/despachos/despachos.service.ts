import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDespachoDto } from './dto/despacho.dto';

@Injectable()
export class DespachosService {
  constructor(private prisma: PrismaService) {}

  async pedidosPendientes() {
    return this.prisma.pedidosOperador.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      include: {
        maquina: true,
        operador: true,
        producto: true,
        mapaMp: true,
      },
      orderBy: { fechaHora: 'asc' },
    });
  }

  async pendientes() {
    const raw: any = await this.prisma.$queryRaw`
      SELECT p.*, m."Serial", m."Ubicacion_Esp", o."Nombre_Completo", pr."Nombre_Producto",
             mp."Capacidad_Max" as "capacidadMax",
             COALESCE(SUM(d."Cant_Despachada"), 0) as total_despachado
      FROM public."PEDIDOS_OPERADOR" p
      LEFT JOIN public."MAQUINAS_Y_TIENDAS" m ON p."ID_Maquina" = m."ID_Maquina"
      LEFT JOIN public."OPERADORES" o ON p."ID_Operador" = o."ID_Operador"
      LEFT JOIN public."PRODUCTOS" pr ON p."ID_Producto" = pr."ID_Producto"
      LEFT JOIN public."MAPA_MATERIA_PRIMA" mp ON p."ID_Mapa_MP" = mp."ID_Mapa_MP"
      LEFT JOIN public."DESPACHOS_BODEGA" d ON p."ID_Pedido" = d."ID_Pedido"
      WHERE p."Estado" IN ('PENDIENTE', 'PARCIAL')
      GROUP BY p."ID_Pedido", m."Serial", m."Ubicacion_Esp", o."Nombre_Completo", pr."Nombre_Producto", mp."Capacidad_Max"
      ORDER BY p."Fecha_Hora" ASC
    `;
    return Array.isArray(raw) ? raw : (raw?.value ?? []);
  }

  async create(dto: CreateDespachoDto) {
    return this.prisma.$transaction(
      async (tx) => {
        // Contexto de auditoría dentro de la transacción (el trigger registra idUsuario).
        const uid = dto.idUsuario ? String(dto.idUsuario) : '';
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '${uid}', TRUE)`);

        const result: any[] = [];
        for (const item of dto.items) {
          const pedido = await tx.pedidosOperador.findUnique({
            where: { idPedido: item.idPedido },
            include: { producto: true, mapaMp: true },
          });
          if (!pedido) throw new NotFoundException(`Pedido ${item.idPedido} no encontrado`);
          if (pedido.estado === 'APROBADO' || pedido.estado === 'RECHAZADO') {
            throw new BadRequestException(`Pedido ${item.idPedido} ya está ${pedido.estado}`);
          }

          const stockActual = (pedido.producto as any).stockActual ?? 0;
          const cantSugerida = pedido.cantSugerida;
          const cantSolicitada = item.cantDespachada ?? cantSugerida;
          // "no reponer" solo es decisión explícita del despachador (flag en la UI). Un
          // cantDespachada = 0 sin el flag conserva el comportamiento original de cerrar el
          // pedido sin despacho (productos que no requieren reposición).
          const noReponerExplicito = item.noReponer === true;
          const esCierreSinDespacho = !noReponerExplicito && cantSolicitada === 0;
          let cantDespachada = Math.min(cantSolicitada, stockActual);
          if (cantDespachada < 0) throw new BadRequestException(`Cantidad negativa en pedido ${item.idPedido}`);

          // TOPE POR FÍSICA REAL DEL ESPIRAL: no se puede despachar más de lo que cabe en el
          // espiral. El cupo restante = capacidad máxima − (físico digitado + ya despachado).
          // Así, aunque el pendiente acumulado sea mayor, el despacho nunca supera la capacidad,
          // evitando "rellenar" un espiral con más producto de lo que físicamente admite.
          const capacidadMaxEspiral = Number(pedido.mapaMp?.capacidadMax ?? 0);
          const totalDespachadoPrevio = (
            await tx.despachosBodega.findMany({
              where: { idPedido: pedido.idPedido },
              select: { cantDespachada: true },
            })
          ).reduce((acc, d) => acc + d.cantDespachada, 0);
          const fisicoActualMaquina = (pedido.fisicoDigitado ?? 0) + totalDespachadoPrevio;
          let cupoRestante = stockActual;
          if (capacidadMaxEspiral > 0 && fisicoActualMaquina < capacidadMaxEspiral) {
            cupoRestante = Math.min(cupoRestante, capacidadMaxEspiral - fisicoActualMaquina);
          }
          cantDespachada = Math.min(cantDespachada, cupoRestante);

          // ¿El cero es por cierre sin despacho, "no reponer" o por FALTA DE STOCK?
          // - Cierre sin despacho (esCierreSinDespacho): producto que no requiere reposición.
          //   Comportamiento original: se cierra el pedido APROBADO sin registrar despacho.
          // - "No reponer" (noReponerExplicito) o cupo de espiral lleno: queda PARCIAL con
          //   pendienteDesp = lo faltante y observación distintiva. Efecto:
          //     * el producto NO cuenta como venta en "Vendido por Visita" (pendiente = sugerido
          //       → vendido = 0), y
          //     * NO vuelve a re-pedirse en la siguiente visita (pendiente se resta con
          //       ajustarSugerida).
          // - Falta de stock (sin "no reponer" y sin stock): igual que "no reponer" (PARCIAL +
          //   pendiente), quedando la deuda visible hasta reponer.
          if (cantDespachada === 0) {
            const sinStockReal = cantSolicitada > 0 && stockActual <= 0;
            const stockAntes = Number(pedido.producto?.stockActual ?? 0);
            if (esCierreSinDespacho && pedido.estado === 'PENDIENTE') {
              await tx.pedidosOperador.update({
                where: { idPedido: pedido.idPedido },
                data: { estado: 'APROBADO' },
              });
            } else if (noReponerExplicito || sinStockReal) {
              // "NO REPONER" (decisión explícita) o falta de stock: queda PARCIAL con el faltante.
              const observacion =
                (noReponerExplicito ? 'Espiral NO repuesto (decisión). ' : `Sin stock para despachar (solicitado ${cantSolicitada}). `) +
                (item.observaciones ?? '');
              await tx.pedidosOperador.update({
                where: { idPedido: pedido.idPedido },
                data: { estado: 'PARCIAL' },
              });
              await tx.despachosBodega.create({
                data: {
                  idPedido: pedido.idPedido,
                  idUsuario: dto.idUsuario,
                  cantDespachada: 0,
                  // Para que el pendiente se reste en la próxima visita (evita re-pedir) y a la
                  // vez el informe no lo cuente como venta, se marca el faltante completo.
                  pendienteDesp: cantSolicitada,
                  observaciones: observacion,
                  idMapaMp: pedido.idMapaMp ?? null,
                  stockAntes,
                  stockDespues: stockAntes,
                },
              });
            }
            // Si llega a 0 por cupo de espiral lleno (sin "no reponer" ni falta de stock real),
            // simplemente no se registra despacho (el pedido permanece como estaba).
            continue;
          }

          const pendienteDesp = cantSugerida - cantDespachada;

          // Registro del estado del stock del producto para trazabilidad en el despacho.
          const stockAntes = Number(pedido.producto?.stockActual ?? 0);
          const stockDespues = Math.max(0, stockAntes - cantDespachada);

          if (cantDespachada > 0) {
            await tx.productos.update({
              where: { idProducto: pedido.idProducto },
              data: { stockActual: { decrement: cantDespachada } },
            });
          }

          const nuevoEstado = pendienteDesp <= 0 ? 'APROBADO' : 'PARCIAL';
          await tx.pedidosOperador.update({
            where: { idPedido: pedido.idPedido },
            data: { estado: nuevoEstado },
          });

          const desp = await tx.despachosBodega.create({
            data: {
              idPedido: pedido.idPedido,
              idUsuario: dto.idUsuario,
              cantDespachada,
              pendienteDesp,
              observaciones: item.observaciones ?? null,
              idMapaMp: pedido.idMapaMp ?? null,
              stockAntes,
              stockDespues,
            },
          });
          result.push(desp);
        }
        return { despachos: result, total: result.length };
      },
      // Aumenta los timeouts de la transacción interactiva:
      // - `timeout`: duración máxima de la transacción (default 5000 ms) → 60 s
      // - `maxWait`: espera a que la transacción esté disponible ante presión del pool (default 2000 ms) → 30 s
      { timeout: 60000, maxWait: 30000 },
    );
  }
}
