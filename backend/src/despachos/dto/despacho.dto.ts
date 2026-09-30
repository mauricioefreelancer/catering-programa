import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DespachoItemDto {
  @IsInt() @IsNotEmpty() idPedido: number;
  @IsOptional() @IsInt() cantDespachada?: number;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsInt() idProveedor?: number;
}

export class CreateDespachoDto {
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DespachoItemDto) items: DespachoItemDto[];
}
