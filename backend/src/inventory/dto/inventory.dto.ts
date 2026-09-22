import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class DetalleIngresoDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsInt() @IsNotEmpty() cantidadRecib: number;
  @IsNumber() @IsNotEmpty() costoUnitarioCompra: number;
  @IsOptional() @IsDateString() fechaVenc?: string;
}

export class CreateIngresoDto {
  @IsInt() @IsNotEmpty() idProveedor: number;
  @IsOptional() @IsDateString() fechaHora?: string;
  @IsString() @IsNotEmpty() facturaNum: string;
  @IsString() @IsNotEmpty() observaciones: string;
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DetalleIngresoDto) detalle: DetalleIngresoDto[];
}

export class QueryIngresoDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsInt() idProveedor?: string;
  @IsOptional() @IsDateString() fechaDesde?: string;
  @IsOptional() @IsDateString() fechaHasta?: string;
}
