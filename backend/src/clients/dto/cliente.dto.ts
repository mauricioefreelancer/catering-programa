import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class CreateClienteDto {
  @IsDateString()
  @IsNotEmpty()
  fechaContrato: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nit: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  razonSocial: string;

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
  @IsBoolean()
  estado?: boolean;
}

export class UpdateClienteDto {
  @IsOptional()
  @IsDateString()
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
  @IsBoolean()
  estado?: boolean;
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
