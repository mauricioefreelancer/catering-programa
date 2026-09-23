import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsEmail, MinLength } from 'class-validator';

function normalizeEstadoBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'inactivo' || s === '0' || s === 'false') return false;
  }
  return true;
}

export class CreateRolDto {
  @IsString() @IsNotEmpty() nombreRol: string;
  @IsObject() permisosCrud: any;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;
}

export class UpdateRolDto {
  @IsOptional() @IsString() nombreRol?: string;
  @IsOptional() @IsObject() permisosCrud?: any;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;
}

export class CreateUsuarioDto {
  @IsOptional() @IsInt() idRol?: number;
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() usuarioLogin?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsObject() permisosExcepcion?: any;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;

  // ============ ALIAS FRONTEND LEGACY ============
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() usuario_login?: string;
  @IsOptional() @IsString() id_rol?: string | number;
}

export class UpdateUsuarioDto {
  @IsOptional() @IsInt() idRol?: number;
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() usuarioLogin?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsObject() permisosExcepcion?: any;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;

  // ============ ALIAS FRONTEND LEGACY ============
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() usuario_login?: string;
  @IsOptional() @IsString() id_rol?: string | number;
}

export class QueryAdminDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
