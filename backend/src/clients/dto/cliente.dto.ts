import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

function normalizeEstado(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'inactivo' || s === '0' || s === 'false') return false;
  }
  return true;
}

export class CreateClienteDto {
  @IsOptional()
  @IsString()
  fechaContrato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  contactoNombre?: string;

  @IsOptional()
  @IsString()
  contactoTelefono?: string;

  @IsOptional()
  @IsEmail()
  contactoCorreo?: string;

  @IsOptional()
  @IsString()
  contactoDireccion?: string;

  @IsOptional()
  @IsString()
  contactoCiudad?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeEstado(value))
  @IsBoolean()
  estado?: boolean;

  // =====================================================
  // CAMPOS ALIAS (compatibilidad Frontend legacy mock)
  // Normalizacion flexible en clients.service.ts (admite DD/MM/YYYY o YYYY-MM-DD)
  // =====================================================
  @IsOptional() @IsString() nombres?: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() tipo_identificacion?: string;
  @IsOptional() @IsString() identificacion?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsString() tipo_cliente?: string;
  @IsOptional() @IsString() @MaxLength(30) NIT?: string;
  @IsOptional() @IsString() @MaxLength(250) razon_social?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() fecha_contrato?: string;
}

export class UpdateClienteDto {
  @IsOptional() @IsString() fechaContrato?: string;
  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsOptional() @IsString() @MaxLength(250) razonSocial?: string;
  @IsOptional() @IsString() contactoNombre?: string;
  @IsOptional() @IsString() contactoTelefono?: string;
  @IsOptional() @IsEmail() contactoCorreo?: string;
  @IsOptional() @IsString() contactoDireccion?: string;
  @IsOptional() @IsString() contactoCiudad?: string;
  @IsOptional()
  @Transform(({ value }) => normalizeEstado(value))
  @IsBoolean()
  estado?: boolean;

  @IsOptional() @IsString() nombres?: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() tipo_identificacion?: string;
  @IsOptional() @IsString() identificacion?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsString() tipo_cliente?: string;
  @IsOptional() @IsString() @MaxLength(30) NIT?: string;
  @IsOptional() @IsString() @MaxLength(250) razon_social?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() fecha_contrato?: string;
}

export class QueryClienteDto {
  @IsOptional()
  skip?: string;

  @IsOptional()
  take?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

