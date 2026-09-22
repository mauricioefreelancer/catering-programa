import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClienteDto, UpdateClienteDto, QueryClienteDto } from './dto/cliente.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('clientes')
@UseGuards(AuthGuard('jwt'))
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Permissions('clientes', 'ver')
  findAll(@Query() query: QueryClienteDto) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @Permissions('clientes', 'ver')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(+id);
  }

  @Get(':id/matriz-precios')
  @Permissions('clientes', 'ver')
  getMatrizPrecios(@Param('id') id: string) {
    return this.clientsService.getMatrizPrecios(+id);
  }

  @Post()
  @Permissions('clientes', 'crear')
  create(@Body() dto: CreateClienteDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Permissions('clientes', 'editar')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientsService.update(+id, dto);
  }

  @Delete(':id')
  @Permissions('clientes', 'eliminar')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }
}
