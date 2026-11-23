import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsObject, Max, Min } from 'class-validator';

export class CreateMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
  @IsString() @IsNotEmpty() serial: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsIn(['SNACKS', 'SNACK', 'COMBINADA', 'REFRIGERADA', 'TIENDA', 'CAFE', 'CAFÉ', 'BEBIDA']) tipo?: string;
  @IsOptional() @IsString() ubicacionEsp?: string;
  @IsOptional() @IsObject() mediosPago?: any;
  @IsOptional() @IsNumber() tarifaPromedioOverride?: number;
  @IsOptional() @IsDateString() fechaInstalacion?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
  @IsOptional() @IsNumber() base?: number;
}

export class UpdateMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
  @IsOptional() @IsString() serial?: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsIn(['SNACKS', 'SNACK', 'COMBINADA', 'REFRIGERADA', 'TIENDA', 'CAFE', 'CAFÉ', 'BEBIDA']) tipo?: string;
  @IsOptional() @IsString() ubicacionEsp?: string;
  @IsOptional() @IsObject() mediosPago?: any;
  @IsOptional() @IsNumber() tarifaPromedioOverride?: number;
  @IsOptional() @IsDateString() fechaInstalacion?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
  @IsOptional() @IsNumber() base?: number;
}

export class AsignarMaquinaDto {
  @IsOptional() @IsInt() idCliente?: number;
  @IsOptional() @IsInt() idOperador?: number;
}

export class CreateMapaMPDto {
  @IsInt() @IsNotEmpty() idProducto: number;
  @IsString() @IsNotEmpty() espiralCodigo: string;
  @IsOptional() @IsInt() capacidadMax?: number;
  @IsOptional() @IsBoolean() precioCero?: boolean;
}

export class UpdateMapaMPDto {
  @IsOptional() @IsInt() idProducto?: number;
  @IsOptional() @IsString() espiralCodigo?: string;
  @IsOptional() @IsInt() capacidadMax?: number;
  @IsOptional() @IsBoolean() precioCero?: boolean;
}

export class CreateMapaNRQDto {
  @IsInt() @IsNotEmpty() idProdTerm: number;
  @IsString() @IsNotEmpty() opcionBoton: string;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) lecturaInicial?: number;
}

export class UpdateMapaNRQDto {
  @IsOptional() @IsInt() idProdTerm?: number;
  @IsOptional() @IsString() opcionBoton?: string;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) lecturaInicial?: number;
}

export class QueryMaquinaDto {
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() tipo?: string;
}
