import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class PedidoItemDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsOptional() @IsInt() idMapaMP?: number;
  @IsInt() @Min(0) fisicoDigitado: number;
}

export class LecturaNrqDto {
  @IsOptional() @IsInt() @Min(1) idMapaNRQ?: number;
  @IsOptional() @IsInt() @Min(1) idMapaMP?: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) lecturaActual: number;
}

export class CreatePedidoOperadorDto {
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsInt() @IsNotEmpty() idOperador: number;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) nrEfectivoActual: number;
  @IsOptional() @IsBoolean() reinicioContador?: boolean;
  @IsOptional() @IsBoolean() esCorteMes?: boolean;
  @IsOptional() @IsInt() @Min(0) ultimaVisitaId?: number;
  @IsUUID() idEnvio: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PedidoItemDto) items: PedidoItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LecturaNrqDto) nrqLecturas?: LecturaNrqDto[];
}
