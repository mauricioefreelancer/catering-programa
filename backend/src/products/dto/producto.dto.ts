import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsDecimal } from 'class-validator';

export class CreateProductoDto {
  @IsOptional() @IsInt() idProveedor?: number;
  @IsString() @IsNotEmpty() codigoBarras: string;
  @IsString() @IsNotEmpty() nombreProducto: string;
  @IsIn(['ESTANDAR', 'MATERIA_PRIMA', 'DOSIFICADO']) tipoProducto?: string;
  @IsOptional() @IsString() unidadCompra?: string;
  @IsOptional() @IsString() unidadConsumo?: string;
  @IsOptional() @IsNumber() equivalencia?: number;
  @IsOptional() @IsNumber() costoBase?: number;
  @IsOptional() @IsNumber() porcentajeImp?: number;
  @IsOptional() @IsNumber() costoTotal?: number;
  @IsOptional() @IsInt() @Min(0) stockMin?: number;
  @IsOptional() @IsInt() @Min(0) stockMax?: number;
  @IsOptional() @IsInt() @Min(0) stockActual?: number;
  @IsOptional() @IsBoolean() estado?: boolean;
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
  @IsOptional() @IsBoolean() estado?: boolean;
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
