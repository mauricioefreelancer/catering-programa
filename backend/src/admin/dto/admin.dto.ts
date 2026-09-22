import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsEmail, MinLength } from 'class-validator';

export class CreateRolDto {
  @IsString() @IsNotEmpty() nombreRol: string;
  @IsObject() permisosCrud: any;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class UpdateRolDto {
  @IsOptional() @IsString() nombreRol?: string;
  @IsOptional() @IsObject() permisosCrud?: any;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class CreateUsuarioDto {
  @IsInt() @IsNotEmpty() idRol: number;
  @IsString() @IsNotEmpty() nombreCompleto: string;
  @IsString() @IsNotEmpty() usuarioLogin: string;
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() @MinLength(6) password: string;
  @IsOptional() @IsObject() permisosExcepcion?: any;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class UpdateUsuarioDto {
  @IsOptional() @IsInt() idRol?: number;
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() usuarioLogin?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsObject() permisosExcepcion?: any;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class QueryAdminDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
