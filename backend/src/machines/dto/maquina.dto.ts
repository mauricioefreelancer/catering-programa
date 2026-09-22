import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
  @IsString() @IsNotEmpty() serial: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsIn(['SNACKS', 'COMBINADA', 'REFRIGERADA', 'TIENDA', 'CAFE']) tipo?: string;
  @IsOptional() @IsString() ubicacionEsp?: string;
  @IsOptional() @IsObject() mediosPago?: any;
  @IsOptional() @IsNumber() tarifaPromedioOverride?: number;
  @IsOptional() @IsDateString() fechaInstalacion?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class UpdateMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
  @IsOptional() @IsString() serial?: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsIn(['SNACKS', 'COMBINADA', 'REFRIGERADA', 'TIENDA', 'CAFE']) tipo?: string;
  @IsOptional() @IsString() ubicacionEsp?: string;
  @IsOptional() @IsObject() mediosPago?: any;
  @IsOptional() @IsNumber() tarifaPromedioOverride?: number;
  @IsOptional() @IsDateString() fechaInstalacion?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}

export class AsignarMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
}

export class CreateMapaMPDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsString() @IsNotEmpty() espiralCodigo: string;
  @IsOptional() @IsInt() capacidadMax?: number;
}

export class UpdateMapaMPDto {
  @IsOptional() @IsInt() idProducto?: number;
  @IsOptional() @IsString() espiralCodigo?: string;
  @IsOptional() @IsInt() capacidadMax?: number;
}

export class CreateMapaNRQDto {
  @IsInt() @IsNotEmpty() idProdTerm: number;
  @IsString() @IsNotEmpty() opcionBoton: string;
}

export class UpdateMapaNRQDto {
  @IsOptional() @IsInt() idProdTerm?: number;
  @IsOptional() @IsString() opcionBoton?: string;
}

export class QueryMaquinaDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() tipo?: string;
}
