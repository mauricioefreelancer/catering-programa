import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductoDto, UpdateProductoDto, CreateRecetaDto, QueryProductoDto } from './dto/producto.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

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
  @Post(':id/recetas') @Permissions('productos', 'crear') addReceta(@Param('id') id: string, @Body() dto: CreateRecetaDto) { return this.srv.addReceta(+id, dto); }
  @Delete(':id/recetas/:idReceta') @Permissions('productos', 'eliminar') removeReceta(@Param('id') id: string, @Param('idReceta') idReceta: string) { return this.srv.removeReceta(+id, +idReceta); }
}
