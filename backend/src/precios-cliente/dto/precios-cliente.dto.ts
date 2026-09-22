import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePrecioClienteDto {
  @IsInt() @IsNotEmpty() idCliente: number;
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsNumber() @IsNotEmpty() precioVenta: number;
  @IsOptional() @IsNumber() margenActual?: number;
  @IsOptional() @IsNumber() aumentoIpc?: number;
  @IsOptional() alertaMargen?: boolean;
}

export class UpdatePrecioClienteDto {
  @IsOptional() @IsNumber() precioVenta?: number;
  @IsOptional() @IsNumber() margenActual?: number;
  @IsOptional() @IsNumber() aumentoIpc?: number;
  @IsOptional() alertaMargen?: boolean;
}

export class AumentoIpcDto {
  @IsIn(['GLOBAL', 'PRODUCTO_CLIENTE', 'PRODUCTO_GLOBAL']) @IsNotEmpty() modo: string;
  @IsNumber() @IsNotEmpty() porcentaje: number;
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idProducto?: number;
}

export class QueryPrecioDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsInt() idCliente?: string;
  @IsOptional() @IsInt() idProducto?: string;
}
