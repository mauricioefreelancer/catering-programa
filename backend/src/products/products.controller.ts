import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductoDto, UpdateProductoDto, CreateRecetaDto, QueryProductoDto } from './dto/producto.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

interface RecetaWrapperDto {
  receta?: Array<{ idMatPrima?: number; idProductoIngrediente?: number; cantidadDosis?: number; cantidad?: number; unidadDosis?: string; unidad?: string }>;
}

@Controller('productos')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private readonly srv: ProductsService) {}

  @Get() @Permissions('productos', 'ver') findAll(@Query() q: QueryProductoDto) { return this.srv.findAll(q); }
  @Get('stock-critico') @Permissions('productos', 'ver') stockCritico() { return this.srv.stockCritico(); }
  @Get(':id') @Permissions('productos', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post() @Permissions('productos', 'crear') create(@Body() dto: CreateProductoDto) { return this.srv.create(dto); }
  @Patch(':id') @Permissions('productos', 'editar') update(@Param('id') id: string, @Body() dto: UpdateProductoDto) { return this.srv.update(+id, dto); }
  @Delete(':id') @Permissions('productos', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
  @Post(':id/recetas') @Permissions('productos', 'crear') addReceta(@Param('id') id: string, @Body() dtoOrWrapper: CreateRecetaDto | RecetaWrapperDto) {
    return this.addRecetaLegacy(+id, dtoOrWrapper as any);
  }
  @Post(':id/receta') @Permissions('productos', 'crear') addRecetaSingular(@Param('id') id: string, @Body() dtoOrWrapper: CreateRecetaDto | RecetaWrapperDto) {
    return this.addRecetaLegacy(+id, dtoOrWrapper as any);
  }
  @Delete(':id/recetas/:idReceta') @Permissions('productos', 'eliminar') removeReceta(@Param('id') id: string, @Param('idReceta') idReceta: string) { return this.srv.removeReceta(+id, +idReceta); }

  private async addRecetaLegacy(idProducto: number, dtoOrWrapper: (CreateRecetaDto & { idProductoIngrediente?: number; cantidad?: number }) | RecetaWrapperDto) {
    const wrapper = dtoOrWrapper as RecetaWrapperDto;
    if (Array.isArray(wrapper.receta)) {
      const results = [];
      for (const r of wrapper.receta) {
        const idMatPrima = Number(r.idMatPrima ?? r.idProductoIngrediente);
        const cantidadDosis = Number(r.cantidadDosis ?? r.cantidad);
        const unidadDosis = String(r.unidadDosis ?? r.unidad ?? 'Unidad').slice(0, 50);
        if (!isNaN(idMatPrima) && !isNaN(cantidadDosis)) {
          results.push(await this.srv.addReceta(idProducto, { idMatPrima, cantidadDosis, unidadDosis } as any));
        }
      }
      return { ok: true, guardados: results.length, items: results };
    } else {
      const dto = dtoOrWrapper as CreateRecetaDto & { idProductoIngrediente?: number; cantidad?: number };
      const idMatPrima = Number((dto as any).idMatPrima ?? (dto as any).idProductoIngrediente);
      const cantidadDosis = Number((dto as any).cantidadDosis ?? (dto as any).cantidad ?? 0);
      const unidadDosis = String((dto as any).unidadDosis || 'Unidad').slice(0, 50);
      return this.srv.addReceta(idProducto, { idMatPrima, cantidadDosis, unidadDosis } as any);
    }
  }
}
