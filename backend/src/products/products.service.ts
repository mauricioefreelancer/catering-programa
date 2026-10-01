import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto, UpdateProductoDto, CreateRecetaDto, QueryProductoDto } from './dto/producto.dto';
import { Prisma } from '@prisma/client';

const TIPOS_VALIDOS = ['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO'] as const;

const firstNonEmpty = (...vals: any[]): any => {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

function normalizeProductoInput(dto: CreateProductoDto | UpdateProductoDto) {
  const nombre = firstNonEmpty(dto.nombreProducto, dto.nombre, dto.nombre_producto);
  const codigoBarras = firstNonEmpty(dto.codigoBarras, dto.codigo_barras, dto.sku);
  const tipoProductoRaw = firstNonEmpty(dto.tipoProducto, dto.Tipo_Producto, dto.tipo, dto.categoria);
  let tipoProducto: string | undefined = undefined;
  if (typeof tipoProductoRaw === 'string') {
    const up = tipoProductoRaw.trim().toUpperCase().replace(/ /g, '_');
    if ((TIPOS_VALIDOS as readonly string[]).includes(up)) tipoProducto = up;
    else {
      if (up.includes('MATERIA') || up === 'MP') tipoProducto = 'MATERIA_PRIMA';
      else if (up.includes('DOSIF')) tipoProducto = 'DOSIFICADO';
      else tipoProducto = 'ESTANDAR';
    }
  }
  const result: any = {};
  if (nombre !== undefined) result.nombreProducto = String(nombre).slice(0, 250);
  if (codigoBarras !== undefined) result.codigoBarras = String(codigoBarras).slice(0, 100);
  if (tipoProducto !== undefined) result.tipoProducto = tipoProducto;
  const uc = firstNonEmpty(dto.unidadCompra, dto.unidad_compra, dto.unidad_medida);
  if (uc !== undefined) result.unidadCompra = String(uc).slice(0, 50);
  const ucons = firstNonEmpty(dto.unidadConsumo, dto.unidad_consumo, dto.unidad_medida);
  if (ucons !== undefined) result.unidadConsumo = String(ucons).slice(0, 50);
  const tipoCafeRaw = firstNonEmpty(dto.tipoCafe, dto.tipo_cafe, dto.tipoCafeId);
  if (tipoCafeRaw !== undefined) {
    const up = String(tipoCafeRaw).trim().toUpperCase();
    if (['SOLUBLE', 'GRANO'].includes(up)) result.tipoCafe = up;
    else if (tipoCafeRaw === null || up === '' || up === 'NINGUNO' || up === 'NO') result.tipoCafe = null;
  }
  const equiv = firstNonEmpty(dto.equivalencia);
  if (equiv !== undefined && !isNaN(Number(equiv))) result.equivalencia = Number(equiv);
  const costoBase = firstNonEmpty(dto.costoBase, dto.costo_base, dto.costo_unitario);
  if (costoBase !== undefined && !isNaN(Number(costoBase))) result.costoBase = Number(costoBase);
  const porcImp = firstNonEmpty(dto.porcentajeImp, dto.IVA, dto.iva);
  if (porcImp !== undefined && !isNaN(Number(porcImp))) result.porcentajeImp = Number(porcImp);
  const costoTotal = firstNonEmpty(dto.costoTotal, dto.costo_total, dto.precio_publico);
  if (costoTotal !== undefined && !isNaN(Number(costoTotal))) result.costoTotal = Number(costoTotal);
  const sMin = firstNonEmpty(dto.stockMin, dto.stock_minimo);
  if (sMin !== undefined && !isNaN(Number(sMin))) result.stockMin = Number(sMin);
  const sMax = firstNonEmpty(dto.stockMax, dto.stock_maximo);
  if (sMax !== undefined && !isNaN(Number(sMax))) result.stockMax = Number(sMax);
  const sAct = firstNonEmpty(dto.stockActual, dto.stock_actual);
  if (sAct !== undefined && !isNaN(Number(sAct))) result.stockActual = Number(sAct);
  if (typeof dto.idProveedor === 'number' || (typeof dto.idProveedor === 'string' && /^\d+$/.test(dto.idProveedor))) {
    result.idProveedor = Number(dto.idProveedor);
  }
  if (typeof dto.estado === 'boolean') result.estado = dto.estado;
  return result;
}

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
      this.prisma.productos.findMany({
        skip,
        take,
        where,
        orderBy: { fechaCreacion: 'desc' },
        include: { proveedor: { select: { idProveedor: true, razonSocial: true } } },
      }),
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
    const data = normalizeProductoInput(dto);
    data.tipoProducto = data.tipoProducto ?? 'ESTANDAR';
    if (!data.nombreProducto) throw new BadRequestException('El nombre del producto es obligatorio (nombre / nombreProducto)');
    if (!data.codigoBarras) data.codigoBarras = `SKU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    data.estado = data.estado ?? true;
    data.equivalencia = data.equivalencia ?? 1;
    data.costoBase = data.costoBase ?? 0;
    data.porcentajeImp = data.porcentajeImp ?? 0;
    data.costoTotal = data.costoTotal ?? (data.costoBase ? (data.costoBase * (1 + (data.porcentajeImp || 0) / 100)) : 0);
    data.stockMin = data.stockMin ?? 0;
    data.stockMax = data.stockMax ?? 0;
    data.stockActual = data.stockActual ?? 0;
    return this.prisma.productos.create({ data });
  }

  async update(id: number, dto: UpdateProductoDto) {
    await this.findOne(id);
    const data = normalizeProductoInput(dto);
    return this.prisma.productos.update({ where: { idProducto: id }, data });
  }

  async remove(id: number) {
    const p = await this.findOne(id);
    if (p.tipoProducto === 'DOSIFICADO') {
      throw new BadRequestException('No se puede eliminar un producto DOSIFICADO: son productos fijos parametrizados con fórmulas internas (recetas) del sistema.');
    }
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
    return this.prisma.recetasDosificados.upsert({
      where: {
        idProdTerm_idMatPrima: { idProdTerm: idProducto, idMatPrima: dto.idMatPrima },
      },
      update: {
        cantidadDosis: new Prisma.Decimal(dto.cantidadDosis),
        unidadDosis: dto.unidadDosis,
      },
      create: {
        idProdTerm: idProducto,
        idMatPrima: dto.idMatPrima,
        cantidadDosis: new Prisma.Decimal(dto.cantidadDosis),
        unidadDosis: dto.unidadDosis,
      },
    });
  }

  async syncReceta(
    idProducto: number,
    items: Array<{ idMatPrima: number; cantidadDosis: number; unidadDosis?: string }>,
  ) {
    const producto = await this.findOne(idProducto);
    if (producto.tipoProducto !== 'DOSIFICADO') {
      throw new BadRequestException('Solo los productos DOSIFICADOS pueden tener recetas');
    }
    // validar que todos los ingredientes sean Materia Prima
    const idsMatPrima = items.map((i) => i.idMatPrima);
    const mps = idsMatPrima.length
      ? await this.prisma.productos.findMany({
          where: { idProducto: { in: idsMatPrima } },
          select: { idProducto: true, tipoProducto: true },
        })
      : [];
    for (const mpId of idsMatPrima) {
      const mp = mps.find((m) => m.idProducto === mpId);
      if (!mp || mp.tipoProducto !== 'MATERIA_PRIMA') {
        throw new BadRequestException(`El ingrediente ${mpId} debe ser una MATERIA_PRIMA`);
      }
    }
    // eliminar recetas del producto que ya no están en la lista enviada
    await this.prisma.recetasDosificados.deleteMany({
      where: {
        idProdTerm: idProducto,
        idMatPrima: { notIn: idsMatPrima.length ? idsMatPrima : [-1] },
      },
    });
    // upsert cada ingrediente de la lista
    const results: any[] = [];
    for (const item of items) {
      results.push(
        await this.prisma.recetasDosificados.upsert({
          where: {
            idProdTerm_idMatPrima: { idProdTerm: idProducto, idMatPrima: item.idMatPrima },
          },
          update: {
            cantidadDosis: new Prisma.Decimal(item.cantidadDosis),
            unidadDosis: String(item.unidadDosis || 'Und').slice(0, 50),
          },
          create: {
            idProdTerm: idProducto,
            idMatPrima: item.idMatPrima,
            cantidadDosis: new Prisma.Decimal(item.cantidadDosis),
            unidadDosis: String(item.unidadDosis || 'Und').slice(0, 50),
          },
        }),
      );
    }
    return { ok: true, guardados: results.length, items: results };
  }

  async removeReceta(idProducto: number, idReceta: number) {
    const receta = await this.prisma.recetasDosificados.findUnique({ where: { idReceta } });
    if (!receta || receta.idProdTerm !== idProducto) {
      throw new NotFoundException('Receta no encontrada');
    }
    return this.prisma.recetasDosificados.delete({ where: { idReceta } });
  }
}

