import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEfectivoNrDto {
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsInt() @IsNotEmpty() idOperador: number;
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsNumber() @IsNotEmpty() nrActual: number;
  @IsNumber() @IsNotEmpty() efectivoRecog: number;
  @IsOptional() @IsDateString() fechaHora?: string;
}

export class CreateSaldoDigitalDto {
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsString() @IsNotEmpty() plataforma: string;
  @IsNumber() @IsNotEmpty() montoTransaccion: number;
  @IsOptional() @IsDateString() fechaTransaccion?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsInt() @IsNotEmpty() idUsuario: number;
}

export class UpdateSaldoDigitalDto {
  @IsOptional() @IsInt() idMaquina?: number;
  @IsOptional() @IsString() plataforma?: string;
  @IsOptional() @IsNumber() montoTransaccion?: number;
  @IsOptional() @IsString() referencia?: string;
}

export class QueryFacturacionNrqDto {
  @IsDateString() @IsNotEmpty() fechaInicio: string;
  @IsDateString() @IsNotEmpty() fechaFin: string;
  @IsOptional() @IsInt() idCliente?: string;
  @IsOptional() @IsInt() idProducto?: string;
}
