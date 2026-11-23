import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngresoDto, QueryIngresoDto } from './dto/inventory.dto';
import { Prisma } from '@prisma/client';
import { bloquearCostos, recalcularPorMateriasPrimas } from '../common/costo-receta';
import { rangoColombia } from '../common/fecha-colombia';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryIngresoDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.idProveedor) where.idProveedor = parseInt(query.idProveedor);
    const { desde, hasta } = rangoColombia(query.fechaDesde, query.fechaHasta);
    where.fechaHora = { gte: desde, lt: hasta };
    const [data, total] = await Promise.all([
      this.prisma.ingresosBodega.findMany({
        skip, take, where,
        include: { proveedor: true, usuario: true, detalleIngresos: { include: { producto: true } } },
        orderBy: { fechaHora: 'desc' },
      }),
      this.prisma.ingresosBodega.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const ing = await this.prisma.ingresosBodega.findUnique({
      where: { idIngreso: id },
      include: { proveedor: true, usuario: true, detalleIngresos: { include: { producto: true } } },
    });
    if (!ing) throw new NotFoundException('Ingreso no encontrado');
    return ing;
  }

  async create(dto: CreateIngresoDto) {
    const prov = await this.prisma.proveedores.findUnique({ where: { idProveedor: dto.idProveedor } });
    if (!prov) throw new NotFoundException('Proveedor no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await bloquearCostos(tx);
      const ids = [...new Set(dto.detalle.map(d => d.idProducto))].sort((a, b) => a - b);
      const productos = await tx.productos.findMany({ where: { idProducto: { in: ids } } });
      const porId = new Map(productos.map(p => [p.idProducto, p]));
      for (const id of ids) {
        const producto = porId.get(id);
        if (!producto) throw new BadRequestException(`Producto ${id} no existe`);
        if (producto.tipoProducto === 'DOSIFICADO') throw new BadRequestException('Los dosificados no se compran ni manejan existencias');
      }
      // Configura el contexto de auditoría dentro de la MISMA transacción para que el
      // trigger registre el usuario correcto (con pool de conexiones el contexto del
      // middleware no llega a la conexión que ejecuta la mutación).
      await this.setAuditContext(tx, dto.idUsuario);

      const ingreso = await tx.ingresosBodega.create({
        data: {
          idProveedor: dto.idProveedor,
          fechaHora: dto.fechaHora ? new Date(dto.fechaHora) : new Date(),
          facturaNum: dto.facturaNum,
          observaciones: dto.observaciones,
          idUsuario: dto.idUsuario,
        },
      });

      const cantidades = new Map<number, number>();
      for (const d of dto.detalle) {
        await tx.detalleIngresos.create({
          data: {
            idIngreso: ingreso.idIngreso,
            idProducto: d.idProducto,
            cantidadRecib: d.cantidadRecib,
            costoUnitarioCompra: new Prisma.Decimal(d.costoUnitarioCompra),
            fechaVenc: d.fechaVenc ? new Date(d.fechaVenc) : null,
          },
        });

        cantidades.set(d.idProducto, (cantidades.get(d.idProducto) ?? 0) + d.cantidadRecib);
      }
      const cambiosCosto: { idProducto: number; nombreProducto: string; anterior: string; nuevo: string }[] = [];
      const materiasPrimas: number[] = [];
      for (const id of ids) {
        const producto = porId.get(id)!;
        const ultimaCompra = await tx.detalleIngresos.findFirstOrThrow({
          where: { idProducto: id },
          orderBy: [{ ingreso: { fechaHora: 'desc' } }, { idIngreso: 'desc' }, { idDetIngreso: 'desc' }],
        });
        const costo = ultimaCompra.costoUnitarioCompra;
        if (!producto.costoBase.eq(costo)) {
          cambiosCosto.push({ idProducto: id, nombreProducto: producto.nombreProducto, anterior: producto.costoBase.toString(), nuevo: costo.toString() });
          if (producto.tipoProducto === 'MATERIA_PRIMA') materiasPrimas.push(id);
        }
        await tx.productos.update({
          where: { idProducto: id },
          data: {
            stockActual: { increment: cantidades.get(id)! },
            costoBase: costo,
            costoTotal: costo.mul(producto.porcentajeImp.div(100).plus(1)),
          },
        });
      }

      await recalcularPorMateriasPrimas(tx, materiasPrimas);
      return { ...ingreso, cambiosCosto };
    });
  }

  private async setAuditContext(tx: Prisma.TransactionClient, userId?: number | null) {
    const uid = userId ? String(userId) : '';
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, TRUE)`;
  }
}
