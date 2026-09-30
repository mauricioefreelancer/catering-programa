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

      // Productos e insumos afectados por este ingreso, para recalcular el agregado global
      const productoIds = new Set<number>();

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

        // Stock por PROVEEDOR (par producto+proveedor del encabezado del ingreso)
        const costo = Number(d.costoUnitarioCompra) || 0;
        const exists = await tx.productosProveedor.findUnique({
          where: { idProducto_idProveedor: { idProducto: d.idProducto, idProveedor: dto.idProveedor } },
        });

        if (exists) {
          // Caso 1: mismo producto + mismo proveedor → se SUMA al stock existente
          const nuevoStockPar = exists.stockActual + d.cantidadRecib;
          let nuevoCosto = Number(exists.costoCompra);
          if (exists.stockActual > 0) {
            nuevoCosto = (exists.stockActual * Number(exists.costoCompra) + d.cantidadRecib * costo) / nuevoStockPar;
          } else if (costo > 0) {
            nuevoCosto = costo;
          }
          await tx.productosProveedor.update({
            where: { idProducto_idProveedor: { idProducto: d.idProducto, idProveedor: dto.idProveedor } },
            data: {
              stockActual: nuevoStockPar,
              costoCompra: new Prisma.Decimal(Math.round(nuevoCosto * 100) / 100),
              fechaUltimaActualizacion: new Date(),
            },
          });
        } else {
          // Caso 2: mismo producto pero NUEVO proveedor → se crea un registro independiente
          // con el precio de compra específico que dio ese proveedor.
          await tx.productosProveedor.create({
            data: {
              idProducto: d.idProducto,
              idProveedor: dto.idProveedor,
              stockActual: d.cantidadRecib,
              costoCompra: new Prisma.Decimal(Math.round(costo * 100) / 100),
            },
          });
        }

        productoIds.add(d.idProducto);
      }

      // Recalcular el agregado del PRODUCTO (stock total y costo promedio ponderado global)
      // para mantener compatibilidad con dashboard, despachos y stock crítico.
      for (const idProducto of productoIds) {
        const pps = await tx.productosProveedor.findMany({ where: { idProducto } });
        if (!pps.length) continue;
        const stockTotal = pps.reduce((s, p) => s + p.stockActual, 0);
        const costoTotalG = pps.reduce((s, p) => s + Number(p.costoCompra) * p.stockActual, 0);
        const costoPromedio = stockTotal > 0 ? costoTotalG / stockTotal : 0;
        await tx.productos.update({
          where: { idProducto },
          data: {
            stockActual: stockTotal,
            costoBase: new Prisma.Decimal(Math.round(costoPromedio * 100) / 100),
          },
        });
      }

      return ingreso;
    });
  }
}
