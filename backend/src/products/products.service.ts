import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto, UpdateProductoDto, CreateRecetaDto, QueryProductoDto } from './dto/producto.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryProductoDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { nombreProducto: { contains: query.search, mode: 'insensitive' } },
        { codigoBarras: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.tipo) where.tipoProducto = query.tipo;
    const [data, total] = await Promise.all([
      this.prisma.productos.findMany({ skip, take, where, orderBy: { fechaCreacion: 'desc' } }),
      this.prisma.productos.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const p = await this.prisma.productos.findUnique({
      where: { idProducto: id },
      include: { recetasProdTerm: true, recetasMatPrima: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async stockCritico() {
    return this.prisma.productos.findMany({
      where: {
        estado: true,
        stockActual: { lte: this.prisma.productos.fields.stockMin as any },
      },
      orderBy: { stockActual: 'asc' },
    });
  }

  async create(dto: CreateProductoDto) {
    return this.prisma.productos.create({ data: dto });
  }

  async update(id: number, dto: UpdateProductoDto) {
    await this.findOne(id);
    return this.prisma.productos.update({ where: { idProducto: id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.productos.delete({ where: { idProducto: id } });
  }

  async addReceta(idProducto: number, dto: CreateRecetaDto) {
    const producto = await this.findOne(idProducto);
    if (producto.tipoProducto !== 'DOSIFICADO') {
      throw new BadRequestException('Solo los productos DOSIFICADOS pueden tener recetas');
    }
    const mp = await this.prisma.productos.findUnique({ where: { idProducto: dto.idMatPrima } });
    if (!mp || mp.tipoProducto !== 'MATERIA_PRIMA') {
      throw new BadRequestException('El ingrediente debe ser una MATERIA_PRIMA (Manual 1.3: insumo empaque grande / consumo fracción)');
    }
    return this.prisma.recetasDosificados.create({
      data: {
        idProdTerm: idProducto,
        idMatPrima: dto.idMatPrima,
        cantidadDosis: new Prisma.Decimal(dto.cantidadDosis),
        unidadDosis: dto.unidadDosis,
      },
    });
  }

  async removeReceta(idProducto: number, idReceta: number) {
    const receta = await this.prisma.recetasDosificados.findUnique({ where: { idReceta } });
    if (!receta || receta.idProdTerm !== idProducto) {
      throw new NotFoundException('Receta no encontrada');
    }
    return this.prisma.recetasDosificados.delete({ where: { idReceta } });
  }
}
