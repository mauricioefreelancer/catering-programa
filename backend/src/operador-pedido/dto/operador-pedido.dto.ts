import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, ValidateNested } from 'class-validator';

export class PedidoItemDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsOptional() @IsInt() idMapaMP?: number;
  @IsInt() @IsNotEmpty() fisicoDigitado: number;
}

export class NrqItemDto {
  @IsInt() @IsNotEmpty() idMapaNRQ: number;
  @IsNumber() @IsNotEmpty() valor: number;
}

export class CreatePedidoOperadorDto {
  @IsInt() @IsNotEmpty() idMaquina: number;
  @IsInt() @IsNotEmpty() idOperador: number;
  @IsOptional() @IsNumber() nrActual?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PedidoItemDto) items: PedidoItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NrqItemDto) nrqItems?: NrqItemDto[];
}
