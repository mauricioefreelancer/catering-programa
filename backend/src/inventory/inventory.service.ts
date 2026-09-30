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

    // Validamos que los items del detalle hagan referencia a productos existentes
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
        const producto = await tx.productos.findUnique({ where: { idProducto: d.idProducto } });
        if (!producto) continue;

        // Modelo GS1: el código de barras identifica al producto (único), NO al proveedor.
        // Un solo artículo (p.ej. CocaCola) se compra a distintos proveedores, pero el stock y
        // el costo base son ÚNICOS del producto. El proveedor y el costo de cada lote quedan
        // registrados aquí en DETALLE_INGRESOS (y en INGRESOS_BODEGA.idProveedor) para tener
        // trazabilidad de a quién y a cuánto se compró, sin duplicar el catálogo.
        const idProductoDestino = producto.idProducto;

        await tx.detalleIngresos.create({
          data: {
            idIngreso: ingreso.idIngreso,
            idProducto: idProductoDestino,
            cantidadRecib: d.cantidadRecib,
            costoUnitarioCompra: new Prisma.Decimal(d.costoUnitarioCompra),
            fechaVenc: d.fechaVenc ? new Date(d.fechaVenc) : null,
          },
        });

        const stockAnt = producto.stockActual;
        const costoAnt = Number(producto.costoBase);
        const stockNuevo = stockAnt + d.cantidadRecib;
        // Costo promedio ponderado: aplica a todos los productos excepto los DOSIFICADOS
        // (CocaCola comprada a $100 con prov A y a $120 con prov B queda en ~$110).
        // Garantiza un costo base único y realista del artículo, sin duplicar el catálogo.
        let costoNuevo = costoAnt;
        if (producto.tipoProducto !== 'DOSIFICADO' && d.costoUnitarioCompra > 0 && stockNuevo > 0) {
          costoNuevo = (stockAnt * costoAnt + d.cantidadRecib * d.costoUnitarioCompra) / stockNuevo;
        }
        await tx.productos.update({
          where: { idProducto: idProductoDestino },
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
