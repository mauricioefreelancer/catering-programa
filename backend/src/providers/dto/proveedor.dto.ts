import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProveedorDto {
  @IsString() @IsNotEmpty() @MaxLength(30) nit: string;
  @IsString() @IsNotEmpty() @MaxLength(250) razonSocial: string;
  @IsOptional() @IsString() asesorNombre?: string;
  @IsOptional() @IsString() asesorTelefono?: string;
  @IsOptional() @IsEmail() asesorCorreo?: string;
  @IsOptional() @IsString() condicionPagoTipo?: string;
  @IsOptional() @IsInt() @Min(0) condicionPagoDias?: number;
  @IsOptional() @IsString() bancoNombre?: string;
  @IsOptional() @IsString() bancoTipoCuenta?: string;
  @IsOptional() @IsString() bancoNumeroCuenta?: string;
  @IsOptional() @IsString() bancoTitular?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class UpdateProveedorDto {
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(250) razonSocial?: string;
  @IsOptional() @IsString() asesorNombre?: string;
  @IsOptional() @IsString() asesorTelefono?: string;
  @IsOptional() @IsEmail() asesorCorreo?: string;
  @IsOptional() @IsString() condicionPagoTipo?: string;
  @IsOptional() @IsInt() @Min(0) condicionPagoDias?: number;
  @IsOptional() @IsString() bancoNombre?: string;
  @IsOptional() @IsString() bancoTipoCuenta?: string;
  @IsOptional() @IsString() bancoNumeroCuenta?: string;
  @IsOptional() @IsString() bancoTitular?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class QueryProveedorDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
