import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DespachoItemDto {
  @IsInt() @IsNotEmpty() idPedido: number;
  @IsOptional() @IsInt() @Min(0) cantDespachada?: number;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsBoolean() noReponer?: boolean;
}

export class CreateDespachoDto {
  @IsInt() @IsNotEmpty() idUsuario: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DespachoItemDto) items: DespachoItemDto[];
}
