import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { PreciosClienteService } from './precios-cliente.service';
import { CreatePrecioClienteDto, UpdatePrecioClienteDto, AumentoIpcDto, QueryPrecioDto } from './dto/precios-cliente.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('precios-cliente')
@UseGuards(AuthGuard('jwt'))
export class PreciosClienteController {
  constructor(private readonly srv: PreciosClienteService) {}

  @Get() @Permissions('preciosCliente', 'ver') findAll(@Query() q: QueryPrecioDto) { return this.srv.findAll(q); }
  @Get('alertas-margen') @Permissions('preciosCliente', 'ver') alertas() { return this.srv.alertasMargen(); }
  @Get(':id') @Permissions('preciosCliente', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post() @Permissions('preciosCliente', 'crear') create(@Body() dto: CreatePrecioClienteDto) { return this.srv.create(dto); }
  @Patch('bulk') @Permissions('preciosCliente', 'editar') bulkUpdate(@Body() body: any) { return this.srv.bulkUpdate(body.cambios); }
  @Post('aumento-ipc') @Permissions('preciosCliente', 'editar') aumento(@Body() dto: AumentoIpcDto) { return this.srv.aumentoIpc(dto); }
  @Patch(':id') @Permissions('preciosCliente', 'editar') update(@Param('id') id: string, @Body() dto: UpdatePrecioClienteDto) { return this.srv.update(+id, dto); }
  @Delete(':id') @Permissions('preciosCliente', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
}
