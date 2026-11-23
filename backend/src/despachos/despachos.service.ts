import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDespachoDto } from './dto/despacho.dto';
import { DespachosBodega, Prisma } from '@prisma/client';
import { calcularDespacho, PEDIDOS_ABIERTOS } from '../common/reposicion';

@Injectable()
export class DespachosService {
  constructor(private prisma: PrismaService) {}

  async pedidosPendientes() {
    return this.prisma.pedidosOperador.findMany({
      where: { estado: { in: PEDIDOS_ABIERTOS } },
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

  pendientesPorDespachar() {
    return this.prisma.$queryRaw`
      WITH pedidos AS (
        SELECT p."ID_Maquina", p."ID_Producto", p."ID_Operador",
               coalesce(p."Fecha_Faltante_Original", p."Fecha_Hora") AS origen,
               p."Cant_Sugerida" - coalesce(d.total, 0) AS pendiente
        FROM "PEDIDOS_OPERADOR" p
        LEFT JOIN LATERAL (
          SELECT sum("Cant_Despachada") AS total FROM "DESPACHOS_BODEGA"
          WHERE "ID_Pedido" = p."ID_Pedido"
        ) d ON true
        WHERE p."Estado" IN ('PENDIENTE', 'PARCIAL')
      )
      SELECT p."ID_Maquina" AS "idMaquina", m."Serial" AS serial,
             p."ID_Producto" AS "idProducto", pr."Nombre_Producto" AS producto,
             p."ID_Operador" AS "idOperador", o."Nombre_Completo" AS operador,
             sum(p.pendiente)::int AS pendiente, min(p.origen) AS "fechaOriginal",
             greatest(0, floor(extract(epoch FROM ((now() AT TIME ZONE 'UTC') - min(p.origen))) / 86400))::int AS "diasAntiguedad"
      FROM pedidos p
      JOIN "MAQUINAS_Y_TIENDAS" m ON m."ID_Maquina" = p."ID_Maquina"
      JOIN "PRODUCTOS" pr ON pr."ID_Producto" = p."ID_Producto"
      JOIN "OPERADORES" o ON o."ID_Operador" = p."ID_Operador"
      WHERE p.pendiente > 0
      GROUP BY p."ID_Maquina", m."Serial", p."ID_Producto", pr."Nombre_Producto", p."ID_Operador", o."Nombre_Completo"
      ORDER BY min(p.origen)
    `;
  }

  async create(dto: CreateDespachoDto) {
    return this.prisma.$transaction(
      async (tx) => {
        // Contexto de auditoría dentro de la transacción (el trigger registra idUsuario).
        const uid = dto.idUsuario ? String(dto.idUsuario) : '';
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '${uid}', TRUE)`);

        const ids = [...new Set(dto.items.map(item => item.idPedido))];
        if (!ids.length) return { despachos: [], total: 0 };
        if (ids.length !== dto.items.length) throw new BadRequestException('No repita un pedido en el despacho');
        await tx.$queryRaw`
          SELECT "ID_Pedido" FROM "PEDIDOS_OPERADOR"
          WHERE "ID_Pedido" IN (${Prisma.join(ids)}) ORDER BY "ID_Pedido" FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT "ID_Producto" FROM "PRODUCTOS"
          WHERE "ID_Producto" IN (
            SELECT "ID_Producto" FROM "PEDIDOS_OPERADOR" WHERE "ID_Pedido" IN (${Prisma.join(ids)})
          ) ORDER BY "ID_Producto" FOR UPDATE
        `;
        const result: DespachosBodega[] = [];
        for (const item of dto.items) {
          const pedido = await tx.pedidosOperador.findUnique({
            where: { idPedido: item.idPedido },
            include: { producto: true, mapaMp: true },
          });
          if (!pedido) throw new NotFoundException(`Pedido ${item.idPedido} no encontrado`);
          if (!PEDIDOS_ABIERTOS.some(estado => estado === pedido.estado)) {
            throw new BadRequestException(`Pedido ${item.idPedido} ya está ${pedido.estado}`);
          }
          const noReponer = item.noReponer === true;
          if (!noReponer && (!pedido.mapaMp || pedido.mapaMp.idMaquina !== pedido.idMaquina ||
              pedido.mapaMp.idProducto !== pedido.idProducto)) {
            throw new BadRequestException(`El pedido ${item.idPedido} no tiene un espiral vigente para ese producto`);
          }
          const { _sum } = await tx.despachosBodega.aggregate({
            where: { idPedido: pedido.idPedido }, _sum: { cantDespachada: true },
          });
          const stock = pedido.producto.stockActual;
          const { cantidad, pendiente, estado } = calcularDespacho({
            sugerido: pedido.cantSugerida,
            acumulado: _sum.cantDespachada ?? 0,
            capacidad: pedido.mapaMp?.capacidadMax ?? 0,
            fisico: pedido.fisicoDigitado,
            stock,
            solicitado: item.cantDespachada,
            noReponer,
          });
          let stockDespues = stock;
          if (cantidad > 0) {
            const [actualizado] = await tx.$queryRaw<{ stock: number }[]>`
              UPDATE "PRODUCTOS" SET "Stock_Actual" = "Stock_Actual" - ${cantidad}
              WHERE "ID_Producto" = ${pedido.idProducto} AND "Stock_Actual" >= ${cantidad}
              RETURNING "Stock_Actual" AS stock
            `;
            if (!actualizado) throw new BadRequestException('El stock cambió; vuelve a cargar los pedidos');
            stockDespues = actualizado.stock;
          }
          await tx.pedidosOperador.update({
            where: { idPedido: pedido.idPedido },
            data: { estado },
          });
          if (cantidad === 0 && pendiente === 0 && !noReponer) continue;

          const desp = await tx.despachosBodega.create({
            data: {
              idPedido: pedido.idPedido,
              idUsuario: dto.idUsuario,
              cantDespachada: cantidad,
              pendienteDesp: pendiente,
              observaciones: item.observaciones ?? (noReponer ? 'No reponer' : stock === 0 ? 'Sin stock' : null),
              idMapaMp: pedido.idMapaMp ?? null,
              stockAntes: stockDespues + cantidad,
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
