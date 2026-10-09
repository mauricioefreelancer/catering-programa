import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DespachoItemDto {
  @IsInt() @IsNotEmpty() idPedido: number;
  @IsOptional() @IsInt() cantDespachada?: number;
  @IsOptional() @IsString() observaciones?: string;
  // Marca que el espiral NO se repone (cero por decisión, no por falta de stock),
  // de modo que no cuente como venta y no vuelva a pedirse en la siguiente visita.
  @IsOptional() noReponer?: boolean;
}

export class CreateDespachoDto {
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DespachoItemDto) items: DespachoItemDto[];
}
