import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDespachoDto } from './dto/despacho.dto';
import { Prisma } from '@prisma/client';

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
             COALESCE(SUM(d."Cant_Despachada"), 0) as total_despachado
      FROM public."PEDIDOS_OPERADOR" p
      LEFT JOIN public."MAQUINAS_Y_TIENDAS" m ON p."ID_Maquina" = m."ID_Maquina"
      LEFT JOIN public."OPERADORES" o ON p."ID_Operador" = o."ID_Operador"
      LEFT JOIN public."PRODUCTOS" pr ON p."ID_Producto" = pr."ID_Producto"
      LEFT JOIN public."DESPACHOS_BODEGA" d ON p."ID_Pedido" = d."ID_Pedido"
      WHERE p."Estado" IN ('PENDIENTE', 'PARCIAL')
      GROUP BY p."ID_Pedido", m."Serial", m."Ubicacion_Esp", o."Nombre_Completo", pr."Nombre_Producto"
      ORDER BY p."Fecha_Hora" ASC
    `;
    return Array.isArray(raw) ? raw : (raw?.value ?? []);
  }

  async create(dto: CreateDespachoDto) {
    return this.prisma.$transaction(async (tx) => {
      const result: any[] = [];
      for (const item of dto.items) {
        const pedido = await tx.pedidosOperador.findUnique({
          where: { idPedido: item.idPedido },
          include: { producto: true },
        });
        if (!pedido) throw new NotFoundException(`Pedido ${item.idPedido} no encontrado`);
        if (pedido.estado === 'APROBADO' || pedido.estado === 'RECHAZADO') {
          throw new BadRequestException(`Pedido ${item.idPedido} ya está ${pedido.estado}`);
        }

        // Proveedor efectivo: el elegido en el despacho, o el definido en el pedido
        // (que a su vez proviene del mapa de la máquina).
        const idProvEfectivo = item.idProveedor ?? (pedido as any).idProveedor ?? null;
        let stockDisponible = (pedido.producto as any).stockActual ?? 0;
        if (idProvEfectivo) {
          const sp = await tx.stockProveedor.findUnique({
            where: {
              idProducto_idProveedor: {
                idProducto: pedido.idProducto,
                idProveedor: idProvEfectivo,
              },
            },
          });
          stockDisponible = sp?.stockActual ?? 0;
        }
        const cantSugerida = pedido.cantSugerida;
        const cantSolicitada = item.cantDespachada ?? cantSugerida;
        const cantDespachada = Math.min(cantSolicitada, stockDisponible);
        if (cantDespachada < 0) throw new BadRequestException(`Cantidad negativa en pedido ${item.idPedido}`);

        const pendienteDesp = Math.max(0, cantSugerida - cantDespachada);

        if (cantDespachada > 0) {
          if (idProvEfectivo) {
            // Descontar del stock del proveedor efectivo
            const sp = await tx.stockProveedor.findUnique({
              where: {
                idProducto_idProveedor: {
                  idProducto: pedido.idProducto,
                  idProveedor: idProvEfectivo,
                },
              },
            });
            if (sp) {
              await tx.stockProveedor.update({
                where: { idStockProveedor: sp.idStockProveedor },
                data: {
                  stockActual: { decrement: cantDespachada },
                  fechaActualizacion: new Date(),
                },
              });
            }
            // Recalcular el total global del producto (suma de todos sus proveedores)
            const provs = await tx.stockProveedor.findMany({
              where: { idProducto: pedido.idProducto },
              select: { stockActual: true, costoCompra: true },
            });
            const stockGlobal = provs.reduce((a, p) => a + p.stockActual, 0);
            const costoGlobal =
              stockGlobal > 0
                ? provs.reduce((a, p) => a + Number(p.costoCompra) * p.stockActual, 0) / stockGlobal
                : 0;
            await tx.productos.update({
              where: { idProducto: pedido.idProducto },
              data: {
                stockActual: stockGlobal,
                costoBase: new Prisma.Decimal(costoGlobal),
              },
            });
          } else {
            // Sin proveedor: descuento global (histórico)
            await tx.productos.update({
              where: { idProducto: pedido.idProducto },
              data: { stockActual: { decrement: cantDespachada } },
            });
          }
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
          },
        });
        result.push(desp);
      }
      return { despachos: result, total: result.length };
    });
  }
}
