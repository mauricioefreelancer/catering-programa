import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEfectivoNrDto {
  @IsOptional() @IsInt() idGrupo?: number;
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsInt() @IsNotEmpty() idOperador: number;
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsNumber() @IsNotEmpty() nrActual: number;
  @IsOptional() @IsNumber() nrAnterior?: number;
  @IsOptional() @IsNumber() efectivoRecog?: number;
  @IsOptional() @IsNumber() efectivoBilletes?: number;
  @IsOptional() @IsNumber() efectivoMonedas?: number;
  @IsOptional() @IsNumber() veosRecog?: number;
  @IsOptional() @IsNumber() datafonoRecog?: number;
  @IsOptional() @IsNumber() cuposRecog?: number;
  @IsOptional() @IsDateString() fechaHora?: string;
}

// DTO para completar (guardar parcial -> cerrar) un recaudo PENDIENTE con el efectivo.
export class CompletarEfectivoNrDto {
  @IsOptional() @IsNumber() efectivoRecog?: number;
  @IsOptional() @IsNumber() efectivoBilletes?: number;
  @IsOptional() @IsNumber() efectivoMonedas?: number;
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

// Query para "Vendido por Visita": mapea las ventas/despachos de cada máquina por visita.
export class QueryVendidoPorVisitaDto {
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
  @IsOptional() @IsInt() idMaquina?: string;
  @IsOptional() @IsInt() idCliente?: string;
}
