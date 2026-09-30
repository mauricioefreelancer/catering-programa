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

        // 1) Inventario por proveedor: STOCK_PROVEEDOR
        // Si el (producto, proveedor) ya existe -> suma stock (mismo proveedor).
        // Si no existe -> crea un nuevo registro (producto de otro proveedor).
        const provActual = await tx.stockProveedor.findUnique({
          where: {
            idProducto_idProveedor: {
              idProducto: d.idProducto,
              idProveedor: dto.idProveedor,
            },
          },
        });
        const costoCompra = new Prisma.Decimal(d.costoUnitarioCompra);
        if (provActual) {
          const stockProvAnt = provActual.stockActual;
          const costProvAnt = Number(provActual.costoCompra);
          const stockProvNuevo = stockProvAnt + d.cantidadRecib;
          let costProvNuevo = costProvAnt;
          // Costo promedio ponderado dentro del mismo proveedor
          if (stockProvNuevo > 0) {
            costProvNuevo = (stockProvAnt * costProvAnt + d.cantidadRecib * d.costoUnitarioCompra) / stockProvNuevo;
          }
          await tx.stockProveedor.update({
            where: { idStockProveedor: provActual.idStockProveedor },
            data: {
              stockActual: stockProvNuevo,
              costoCompra: new Prisma.Decimal(costProvNuevo),
              fechaActualizacion: new Date(),
            },
          });
        } else {
          await tx.stockProveedor.create({
            data: {
              idProducto: d.idProducto,
              idProveedor: dto.idProveedor,
              stockActual: d.cantidadRecib,
              costoCompra,
            },
          });
        }

        // 2) Recalcular el total global del producto (suma de todos sus proveedores)
        //    y su costo promedio ponderado global (Σ(costo×stock)/Σstock).
        const provs = await tx.stockProveedor.findMany({
          where: { idProducto: d.idProducto },
          select: { stockActual: true, costoCompra: true },
        });
        const stockGlobal = provs.reduce((a, p) => a + p.stockActual, 0);
        const costoGlobal =
          stockGlobal > 0
            ? provs.reduce((a, p) => a + Number(p.costoCompra) * p.stockActual, 0) / stockGlobal
            : 0;
        await tx.productos.update({
          where: { idProducto: d.idProducto },
          data: {
            stockActual: stockGlobal,
            costoBase: new Prisma.Decimal(costoGlobal),
          },
        });
      }

      return ingreso;
    });
  }
}
