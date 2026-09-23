import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

function normalizeEstadoBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'inactivo' || s === '0' || s === 'false') return false;
  }
  return true;
}

export class CreateOperadorDto {
  // ============ CAMPOS OFICIALES PRISMA ============
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() zonaAsignada?: string;
  @IsOptional() @IsDateString() fechaIngreso?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(4) usuarioLogin?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsInt() idRol?: number;
  @IsOptional() @IsInt() idUsuario?: number;

  // ============ ALIAS FRONTEND LEGACY ============
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() usuario_login?: string;
  @IsOptional() @IsString() zona?: string;
  @IsOptional() @IsString() numeroDocumento?: string;
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() id_rol?: string | number;
}

export class UpdateOperadorDto {
  // ============ CAMPOS OFICIALES PRISMA ============
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() zonaAsignada?: string;
  @IsOptional() @IsDateString() fechaIngreso?: string;
  @IsOptional() @Transform(({ value }) => normalizeEstadoBool(value)) @IsBoolean() estado?: boolean;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(4) usuarioLogin?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsInt() idRol?: number;
  @IsOptional() @IsInt() idUsuario?: number;

  // ============ ALIAS FRONTEND LEGACY ============
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() usuario_login?: string;
  @IsOptional() @IsString() zona?: string;
  @IsOptional() @IsString() numeroDocumento?: string;
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() id_rol?: string | number;
}

export class QueryOperadorDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
