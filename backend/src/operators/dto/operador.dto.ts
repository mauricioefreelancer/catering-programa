import { IsBoolean, IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOperadorDto {
  @IsString() @IsNotEmpty() nombreCompleto: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() zonaAsignada?: string;
  @IsOptional() @IsDateString() fechaIngreso?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() @MinLength(4) usuarioLogin: string;
  @IsString() @IsNotEmpty() @MinLength(6) password: string;
  @IsInt() @IsNotEmpty() idRol: number;
}

export class UpdateOperadorDto {
  @IsOptional() @IsString() nombreCompleto?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() zonaAsignada?: string;
  @IsOptional() @IsDateString() fechaIngreso?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() usuarioLogin?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsInt() idRol?: number;
}

export class QueryOperadorDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
}
