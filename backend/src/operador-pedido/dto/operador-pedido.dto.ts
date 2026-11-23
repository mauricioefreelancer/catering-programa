import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class PedidoItemDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsOptional() @IsInt() idMapaMP?: number;
  @IsInt() @Min(0) fisicoDigitado: number;
}

export class NrqItemDto {
  @IsInt() @IsNotEmpty() idMapaNRQ: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) valor: number;
}

export class LecturaNrqDto {
  @IsInt() @Min(1) idMapaNRQ: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) lecturaActual: number;
}

export class CreatePedidoOperadorDto {
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsInt() @IsNotEmpty() idOperador: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) nrActual?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) nrEfectivoActual?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) nrProductoActual?: number;
  @IsOptional() @IsBoolean() reinicioContador?: boolean;
  @IsOptional() @IsInt() @Min(0) ultimaVisitaId?: number;
  @IsOptional() @IsUUID() idOffline?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PedidoItemDto) items: PedidoItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NrqItemDto) nrqItems?: NrqItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LecturaNrqDto) nrqLecturas?: LecturaNrqDto[];
}
