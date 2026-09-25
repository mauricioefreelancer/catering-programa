import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

function normalizeEstado(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'inactivo' || s === '0' || s === 'false') return false;
  }
  return true;
}

// Convierte string vacio a undefined para que @IsOptional la ignore y
// @IsEmail no la rechace con 400 cuando el formulario envia correo vacio.
function emptyToUndefined(v: any): any {
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
}

export class CreateProveedorDto {
  @IsString() @IsNotEmpty() @MaxLength(30) nit: string;
  @IsString() @IsNotEmpty() @MaxLength(250) razonSocial: string;
  @IsOptional() @IsString() asesorNombre?: string;
  @IsOptional() @IsString() asesorTelefono?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() asesorCorreo?: string;
  @IsOptional() @IsString() condicionPagoTipo?: string;
  @IsOptional() @IsInt() @Min(0) condicionPagoDias?: number;
  @IsOptional() @IsString() bancoNombre?: string;
  @IsOptional() @IsString() bancoTipoCuenta?: string;
  @IsOptional() @IsString() bancoNumeroCuenta?: string;
  @IsOptional() @IsString() bancoTitular?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstado(value)) @IsBoolean() estado?: boolean;

  // =====================================================
  // CAMPOS ALIAS (compatibilidad Frontend legacy mock)
  // =====================================================
  @IsOptional() @IsString() @MaxLength(30) NIT?: string;
  @IsOptional() @IsString() @MaxLength(250) razon_social?: string;
  @IsOptional() @IsString() asesor?: string;
  @IsOptional() @IsString() nombre_asesor?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() telefono_asesor?: string;
  @IsOptional() @IsString() asesor_telefono?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() email?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() correo?: string;
  @IsOptional() @IsString() condicionesPago?: string;
  @IsOptional() @IsString() condicion_pago?: string;
  @IsOptional() @IsString() condiciones_pago?: string;
  @IsOptional() @IsInt() @Min(0) diasCredito?: number;
  @IsOptional() @IsInt() @Min(0) dias_credito?: number;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() nombre_banco?: string;
  @IsOptional() @IsString() tipo_cuenta?: string;
  @IsOptional() @IsString() tipoCuenta?: string;
  @IsOptional() @IsString() cuentaBancaria?: string;
  @IsOptional() @IsString() cuenta_bancaria?: string;
  @IsOptional() @IsString() numero_cuenta?: string;
  @IsOptional() @IsString() titular?: string;
  @IsOptional() @IsString() titular_cuenta?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstado(value)) @IsBoolean() Estado?: boolean;
}

export class UpdateProveedorDto {
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(250) razonSocial?: string;
  @IsOptional() @IsString() asesorNombre?: string;
  @IsOptional() @IsString() asesorTelefono?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() asesorCorreo?: string;
  @IsOptional() @IsString() condicionPagoTipo?: string;
  @IsOptional() @IsInt() @Min(0) condicionPagoDias?: number;
  @IsOptional() @IsString() bancoNombre?: string;
  @IsOptional() @IsString() bancoTipoCuenta?: string;
  @IsOptional() @IsString() bancoNumeroCuenta?: string;
  @IsOptional() @IsString() bancoTitular?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstado(value)) @IsBoolean() estado?: boolean;

  @IsOptional() @IsString() @MaxLength(30) NIT?: string;
  @IsOptional() @IsString() @MaxLength(250) razon_social?: string;
  @IsOptional() @IsString() asesor?: string;
  @IsOptional() @IsString() nombre_asesor?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() telefono_asesor?: string;
  @IsOptional() @IsString() asesor_telefono?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() email?: string;
  @IsOptional() @Transform(({ value }) => emptyToUndefined(value)) @IsEmail() correo?: string;
  @IsOptional() @IsString() condicionesPago?: string;
  @IsOptional() @IsString() condicion_pago?: string;
  @IsOptional() @IsString() condiciones_pago?: string;
  @IsOptional() @IsInt() @Min(0) diasCredito?: number;
  @IsOptional() @IsInt() @Min(0) dias_credito?: number;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() nombre_banco?: string;
  @IsOptional() @IsString() tipo_cuenta?: string;
  @IsOptional() @IsString() tipoCuenta?: string;
  @IsOptional() @IsString() cuentaBancaria?: string;
  @IsOptional() @IsString() cuenta_bancaria?: string;
  @IsOptional() @IsString() numero_cuenta?: string;
  @IsOptional() @IsString() titular?: string;
  @IsOptional() @IsString() titular_cuenta?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstado(value)) @IsBoolean() Estado?: boolean;
}

export class QueryProveedorDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
