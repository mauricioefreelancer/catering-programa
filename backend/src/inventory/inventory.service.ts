import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngresoDto, QueryIngresoDto } from './dto/inventory.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryIngresoDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.idProveedor) where.idProveedor = parseInt(query.idProveedor);
    if (query.fechaDesde || query.fechaHasta) {
      where.fechaHora = {};
      if (query.fechaDesde) where.fechaHora.gte = new Date(query.fechaDesde);
      if (query.fechaHasta) where.fechaHora.lte = new Date(query.fechaHasta);
    }
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

    for (const d of dto.detalle) {
      const p = await this.prisma.productos.findUnique({ where: { idProducto: d.idProducto } });
      if (!p) throw new BadRequestException(`Producto ${d.idProducto} no existe`);
    }

    return this.prisma.$transaction(async (tx) => {
      const ingreso = await tx.ingresosBodega.create({
        data: {
          idProveedor: dto.idProveedor,
          fechaHora: dto.fechaHora ? new Date(dto.fechaHora) : new Date(),
          facturaNum: dto.facturaNum,
          observaciones: dto.observaciones,
          idUsuario: dto.idUsuario,
        },
      });

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

        const producto = await tx.productos.findUnique({ where: { idProducto: d.idProducto } });
        if (!producto) continue;
        const stockAnt = producto.stockActual;
        const costoAnt = Number(producto.costoBase);
        const stockNuevo = stockAnt + d.cantidadRecib;
        let costoNuevo = costoAnt;
        if (producto.tipoProducto === 'MATERIA_PRIMA' && stockNuevo > 0) {
          costoNuevo = (stockAnt * costoAnt + d.cantidadRecib * d.costoUnitarioCompra) / stockNuevo;
        } else if (d.costoUnitarioCompra > 0 && costoAnt === 0) {
          costoNuevo = d.costoUnitarioCompra;
        }
        await tx.productos.update({
          where: { idProducto: d.idProducto },
          data: {
            stockActual: stockNuevo,
            costoBase: new Prisma.Decimal(costoNuevo),
          },
        });
      }

      return ingreso;
    });
  }
}
