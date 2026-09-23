import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsDecimal } from 'class-validator';

function normalizeEstadoBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'inactivo' || s === '0' || s === 'false') return false;
  }
  return true;
}

export class CreateProductoDto {
  @IsOptional() @IsInt() idProveedor?: number;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsString() nombreProducto?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipoProducto?: string;
  @IsOptional() @IsString() unidadCompra?: string;
  @IsOptional() @IsString() unidadConsumo?: string;
  @IsOptional() @IsNumber() equivalencia?: number;
  @IsOptional() @IsNumber() costoBase?: number;
  @IsOptional() @IsNumber() porcentajeImp?: number;
  @IsOptional() @IsNumber() costoTotal?: number;
  @IsOptional() @IsInt() @Min(0) stockMin?: number;
  @IsOptional() @IsInt() @Min(0) stockMax?: number;
  @IsOptional() @IsInt() @Min(0) stockActual?: number;
  @IsOptional()
  @Transform(({ value }) => normalizeEstadoBool(value))
  @IsBoolean()
  estado?: boolean;

  // =====================================================
  // CAMPOS ALIAS (compatibilidad Frontend legacy mock)
  // =====================================================
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() nombre_producto?: string;
  @IsOptional() @IsString() codigo_barras?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) Tipo_Producto?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipo?: string;
  @IsOptional() @IsString() unidad_compra?: string;
  @IsOptional() @IsString() unidad_consumo?: string;
  @IsOptional() @IsNumber() costo_base?: number;
  @IsOptional() @IsNumber() costo_unitario?: number;
  @IsOptional() @IsNumber() IVA?: number;
  @IsOptional() @IsNumber() iva?: number;
  @IsOptional() @IsNumber() costo_total?: number;
  @IsOptional() @IsNumber() precio_publico?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() unidad_medida?: string;
  @IsOptional() @IsInt() @Min(0) stock_minimo?: number;
  @IsOptional() @IsInt() @Min(0) stock_maximo?: number;
  @IsOptional() @IsInt() @Min(0) stock_actual?: number;
}

export class UpdateProductoDto {
  @IsOptional() @IsInt() idProveedor?: number;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsString() nombreProducto?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipoProducto?: string;
  @IsOptional() @IsString() unidadCompra?: string;
  @IsOptional() @IsString() unidadConsumo?: string;
  @IsOptional() @IsNumber() equivalencia?: number;
  @IsOptional() @IsNumber() costoBase?: number;
  @IsOptional() @IsNumber() porcentajeImp?: number;
  @IsOptional() @IsNumber() costoTotal?: number;
  @IsOptional() @IsInt() @Min(0) stockMin?: number;
  @IsOptional() @IsInt() @Min(0) stockMax?: number;
  @IsOptional() @IsInt() @Min(0) stockActual?: number;
  @IsOptional()
  @Transform(({ value }) => normalizeEstadoBool(value))
  @IsBoolean()
  estado?: boolean;

  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() nombre_producto?: string;
  @IsOptional() @IsString() codigo_barras?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) Tipo_Producto?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipo?: string;
  @IsOptional() @IsString() unidad_compra?: string;
  @IsOptional() @IsString() unidad_consumo?: string;
  @IsOptional() @IsNumber() costo_base?: number;
  @IsOptional() @IsNumber() costo_unitario?: number;
  @IsOptional() @IsNumber() IVA?: number;
  @IsOptional() @IsNumber() iva?: number;
  @IsOptional() @IsNumber() costo_total?: number;
  @IsOptional() @IsNumber() precio_publico?: number;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() unidad_medida?: string;
  @IsOptional() @IsInt() @Min(0) stock_minimo?: number;
  @IsOptional() @IsInt() @Min(0) stock_maximo?: number;
  @IsOptional() @IsInt() @Min(0) stock_actual?: number;
}

export class CreateRecetaDto {
  @IsInt() @IsNotEmpty() idMatPrima: number;
  @IsNumber() @IsNotEmpty() cantidadDosis: number;
  @IsString() @IsNotEmpty() unidadDosis: string;
}

export class QueryProductoDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipo?: string;
}



