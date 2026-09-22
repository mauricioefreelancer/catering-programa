import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProveedorDto, UpdateProveedorDto, QueryProveedorDto } from './dto/proveedor.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('proveedores')
@UseGuards(AuthGuard('jwt'))
export class ProvidersController {
  constructor(private readonly srv: ProvidersService) {}

  @Get() @Permissions('proveedores', 'ver') findAll(@Query() q: QueryProveedorDto) { return this.srv.findAll(q); }
  @Get(':id') @Permissions('proveedores', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post() @Permissions('proveedores', 'crear') create(@Body() dto: CreateProveedorDto) { return this.srv.create(dto); }
  @Patch(':id') @Permissions('proveedores', 'editar') update(@Param('id') id: string, @Body() dto: UpdateProveedorDto) { return this.srv.update(+id, dto); }
  @Delete(':id') @Permissions('proveedores', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
}
