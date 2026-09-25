import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrecioClienteDto, UpdatePrecioClienteDto, AumentoIpcDto, QueryPrecioDto } from './dto/precios-cliente.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PreciosClienteService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryPrecioDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.idCliente) where.idCliente = parseInt(query.idCliente);
    if (query.idProducto) where.idProducto = parseInt(query.idProducto);
    const [data, total] = await Promise.all([
      this.prisma.preciosCliente.findMany({ skip, take, where, include: { cliente: true, producto: true }, orderBy: { fechaCreacion: 'desc' } }),
      this.prisma.preciosCliente.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const p = await this.prisma.preciosCliente.findUnique({ where: { idPrecio: id }, include: { cliente: true, producto: true } });
    if (!p) throw new NotFoundException('Precio no encontrado');
    return p;
  }

  async alertasMargen() {
    return this.prisma.preciosCliente.findMany({
      where: { alertaMargen: true },
      include: { cliente: true, producto: true },
      orderBy: { margenActual: 'asc' },
    });
  }

  async create(dto: CreatePrecioClienteDto) {
    const producto = await this.prisma.productos.findUnique({ where: { idProducto: dto.idProducto } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const margen = dto.precioVenta > 0
      ? ((dto.precioVenta - Number(producto.costoTotal)) / dto.precioVenta) * 100
      : 0;
    const umbral = Number(process.env.UMBRAL_MARGEN || 30);
    try {
      return await this.prisma.preciosCliente.create({
        data: {
          idCliente: dto.idCliente,
          idProducto: dto.idProducto,
          precioVenta: new Prisma.Decimal(dto.precioVenta),
          margenActual: new Prisma.Decimal(margen),
          alertaMargen: margen < umbral,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Ya existe un precio asignado para ese cliente y producto. Seleccione otro o edite el existente.');
      }
      throw new BadRequestException(`Error al crear precio: ${e?.message || 'ver log'} (meta: ${JSON.stringify(e?.meta || {})})`);
    }
  }

  async update(id: number, dto: UpdatePrecioClienteDto) {
    const actual = await this.findOne(id);
    const precioVenta = dto.precioVenta ?? Number(actual.precioVenta);
    const costoTotal = Number((actual.producto as any).costoTotal || 0);
    const margen = precioVenta > 0 ? ((precioVenta - costoTotal) / precioVenta) * 100 : 0;
    const umbral = Number(process.env.UMBRAL_MARGEN || 30);
    const data: any = { ...dto };
    if (dto.precioVenta !== undefined) {
      data.precioVenta = new Prisma.Decimal(dto.precioVenta);
      data.margenActual = new Prisma.Decimal(margen);
      data.alertaMargen = margen < umbral;
      data.fechaUltimaActualizacion = new Date();
    }
    return this.prisma.preciosCliente.update({ where: { idPrecio: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.preciosCliente.delete({ where: { idPrecio: id } });
  }

  // Actualizacion masiva de precios recibida desde la UI (PATCH /bulk).
  // `cambios` es un arreglo de { id, precio_venta }.
  async bulkUpdate(cambios: { id: number; precio_venta?: number }[]) {
    if (!Array.isArray(cambios)) throw new BadRequestException('cambios debe ser un arreglo');
    const umbral = Number(process.env.UMBRAL_MARGEN || 30);
    const actualizados: number[] = [];
    const errores: { id: number; mensaje: string }[] = [];

    for (const c of cambios) {
      try {
        const id = Number(c.id);
        if (!id) continue;
        const actual = await this.findOne(id);
        const precioVenta = c.precio_venta !== undefined ? Number(c.precio_venta) : Number(actual.precioVenta);
        const costoTotal = Number((actual.producto as any)?.costoTotal || 0);
        const margen = precioVenta > 0 ? ((precioVenta - costoTotal) / precioVenta) * 100 : 0;
        await this.prisma.preciosCliente.update({
          where: { idPrecio: id },
          data: {
            precioVenta: new Prisma.Decimal(precioVenta),
            margenActual: new Prisma.Decimal(margen),
            alertaMargen: margen < umbral,
            fechaUltimaActualizacion: new Date(),
          },
        });
        actualizados.push(id);
      } catch (e: any) {
        errores.push({ id: Number(c.id), mensaje: e?.message || 'Error al actualizar' });
      }
    }

    return { actualizados: actualizados.length, ids: actualizados, errores };
  }

  async aumentoIpc(dto: AumentoIpcDto) {
    const factor = 1 + dto.porcentaje / 100;
    const where: any = {};
    if (dto.modo === 'PRODUCTO_CLIENTE') {
      if (!dto.idCliente || !dto.idProducto) throw new BadRequestException('idCliente e idProducto requeridos');
      where.idCliente = dto.idCliente;
      where.idProducto = dto.idProducto;
    } else if (dto.modo === 'PRODUCTO_GLOBAL') {
      if (!dto.idProducto) throw new BadRequestException('idProducto requerido');
      where.idProducto = dto.idProducto;
    }
    const precios = await this.prisma.preciosCliente.findMany({ where, include: { producto: true } });
    const umbral = Number(process.env.UMBRAL_MARGEN || 30);
    const actualizados: number[] = [];
    for (const p of precios) {
      const nuevoPrecio = Number(p.precioVenta) * factor;
      const costoTotal = Number((p.producto as any).costoTotal || 0);
      const margen = nuevoPrecio > 0 ? ((nuevoPrecio - costoTotal) / nuevoPrecio) * 100 : 0;
      await this.prisma.preciosCliente.update({
        where: { idPrecio: p.idPrecio },
        data: {
          precioVenta: new Prisma.Decimal(nuevoPrecio),
          aumentoIpc: new Prisma.Decimal(dto.porcentaje),
          margenActual: new Prisma.Decimal(margen),
          alertaMargen: margen < umbral,
          fechaUltimaActualizacion: new Date(),
        },
      });
      actualizados.push(p.idPrecio);
    }
    return { actualizados: actualizados.length, ids: actualizados };
  }
}
