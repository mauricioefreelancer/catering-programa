import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto, UpdateProductoDto, CreateRecetaDto, QueryProductoDto } from './dto/producto.dto';
import { Prisma } from '@prisma/client';
import { bloquearCostos, recalcularPorMateriasPrimas, recalcularReceta } from '../common/costo-receta';
import { esCategoriaInsumo, nombreCategoria, tipoCafeDeCategoria } from '../common/receta-cafe';

const RECETAS_EN_ESTANDAR = 'Las recetas se configuran en Productos → Recetas estándar (por categoría de insumo)';

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
  // Categoría de insumo (café, vaso, mezclador...): campo independiente del tipo técnico
  if (dto.categoriaInsumo === null || dto.categoria_insumo === null) result.categoriaInsumo = null;
  const categoriaInsumo = firstNonEmpty(dto.categoriaInsumo, dto.categoria_insumo);
  if (categoriaInsumo !== undefined) {
    const clave = String(categoriaInsumo).trim().toUpperCase();
    if (!esCategoriaInsumo(clave)) throw new BadRequestException(`Categoría de insumo inválida: ${categoriaInsumo}`);
    result.categoriaInsumo = clave;
  }
  const uc = firstNonEmpty(dto.unidadCompra, dto.unidad_compra, dto.unidad_medida);
  if (uc !== undefined) result.unidadCompra = String(uc).slice(0, 50);
  const ucons = firstNonEmpty(dto.unidadConsumo, dto.unidad_consumo, dto.unidad_medida);
  if (ucons !== undefined) result.unidadConsumo = String(ucons).slice(0, 50);
  // El tipo de café sale de la categoría de insumo; no se digita aparte.
  if (result.categoriaInsumo !== undefined) result.tipoCafe = tipoCafeDeCategoria(result.categoriaInsumo);
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
      include: { recetasEstandar: { orderBy: [{ varianteCafe: 'asc' }, { categoriaInsumo: 'asc' }] } },
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
    if (data.tipoProducto === 'DOSIFICADO' && [data.costoBase, data.costoTotal, data.stockActual].some(v => v != null && Number(v) !== 0)) {
      throw new BadRequestException('El dosificado no maneja stock y su costo se calcula desde la receta');
    }
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
    if (data.tipoProducto !== 'MATERIA_PRIMA') { data.categoriaInsumo = null; data.tipoCafe = null; }
    validarMateriaPrima(data.tipoProducto, data.categoriaInsumo, data.equivalencia);
    return this.prisma.$transaction(async tx => {
      await bloquearCostos(tx);
      const creado = await tx.productos.create({ data });
      if (creado.tipoProducto === 'MATERIA_PRIMA') await recalcularPorMateriasPrimas(tx, [creado.idProducto]);
      return creado;
    });
  }

  async update(id: number, dto: UpdateProductoDto) {
    const data = normalizeProductoInput(dto);
    return this.prisma.$transaction(async tx => {
      await bloquearCostos(tx);
      const previo = await tx.productos.findUnique({ where: { idProducto: id } });
      if (!previo) throw new NotFoundException('Producto no encontrado');
      const tipo = data.tipoProducto ?? previo.tipoProducto;
      if (tipo !== previo.tipoProducto && (tipo === 'DOSIFICADO' || previo.tipoProducto === 'DOSIFICADO')) {
        throw new BadRequestException('No se puede convertir un dosificado ni convertir otro producto en dosificado');
      }
      if (tipo === 'DOSIFICADO' && (data.costoBase != null || data.costoTotal != null || data.stockActual != null)) {
        throw new BadRequestException('El dosificado no maneja stock y su costo se calcula desde la receta');
      }
      if (previo.tipoProducto === 'MATERIA_PRIMA' && tipo !== 'MATERIA_PRIMA' &&
          await tx.recetasDosificados.count({ where: { idMatPrima: id } })) {
        throw new BadRequestException('El ingrediente pertenece a una receta activa');
      }
      if (tipo !== 'MATERIA_PRIMA') { data.categoriaInsumo = null; data.tipoCafe = null; }
      validarMateriaPrima(tipo, data.categoriaInsumo !== undefined ? data.categoriaInsumo : previo.categoriaInsumo,
        Number(data.equivalencia ?? previo.equivalencia));
      if (previo.tipoProducto === 'MATERIA_PRIMA' && previo.categoriaInsumo && data.categoriaInsumo !== undefined &&
          data.categoriaInsumo !== previo.categoriaInsumo &&
          await tx.mapaMateriaPrima.count({ where: { idProducto: id, maquina: { tipo: { in: ['CAFE', 'COMBINADA'] } } } })) {
        throw new BadRequestException('El insumo está asignado a tolvas de cafeteras: quítelo de ellas antes de cambiar su categoría');
      }
      const actualizado = await tx.productos.update({ where: { idProducto: id }, data });
      if (previo.tipoProducto === 'MATERIA_PRIMA' || tipo === 'MATERIA_PRIMA') {
        await recalcularPorMateriasPrimas(tx, [id], previo.categoriaInsumo ? [previo.categoriaInsumo] : []);
      }
      if (tipo === 'DOSIFICADO' && data.porcentajeImp != null) {
        await recalcularReceta(tx, id);
        return tx.productos.findUniqueOrThrow({ where: { idProducto: id } });
      }
      return actualizado;
    });
  }

  async remove(id: number) {
    const p = await this.findOne(id);
    if (p.tipoProducto === 'DOSIFICADO') {
      throw new BadRequestException('No se puede eliminar un producto DOSIFICADO: son productos fijos parametrizados con fórmulas internas (recetas) del sistema.');
    }
    return this.prisma.productos.delete({ where: { idProducto: id } });
  }

  async addReceta(_idProducto: number, _dto: CreateRecetaDto): Promise<never> {
    throw new BadRequestException(RECETAS_EN_ESTANDAR);
  }

  async syncReceta(
    _idProducto: number,
    _items: Array<{ idMatPrima: number; cantidadDosis: number; unidadDosis?: string }>,
  ): Promise<never> {
    throw new BadRequestException(RECETAS_EN_ESTANDAR);
  }

  async removeReceta(_idProducto: number, _idReceta: number): Promise<never> {
    throw new BadRequestException(RECETAS_EN_ESTANDAR);
  }
}

function validarMateriaPrima(tipo: string, categoria: string | null | undefined, equivalencia: number) {
  if (tipo !== 'MATERIA_PRIMA') return;
  if (!categoria) throw new BadRequestException('La materia prima debe tener una categoría de insumo (café grano, leche, vaso...)');
  if (!(equivalencia > 0)) {
    throw new BadRequestException(`La equivalencia de ${nombreCategoria(categoria)} debe ser mayor que 0 (gramos o unidades por empaque)`);
  }
}

