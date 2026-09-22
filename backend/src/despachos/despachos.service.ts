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

        const stockActual = (pedido.producto as any).stockActual ?? 0;
        const cantSugerida = pedido.cantSugerida;
        const cantSolicitada = item.cantDespachada ?? cantSugerida;
        const cantDespachada = Math.min(cantSolicitada, stockActual);
        if (cantDespachada < 0) throw new BadRequestException(`Cantidad negativa en pedido ${item.idPedido}`);

        const pendienteDesp = cantSugerida - cantDespachada;

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
          },
        });
        result.push(desp);
      }
      return { despachos: result, total: result.length };
    });
  }
}
