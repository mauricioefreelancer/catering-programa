import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DespachosService } from './despachos.service';
import { CreateDespachoDto } from './dto/despacho.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DespachosController {
  constructor(private readonly srv: DespachosService) {}

  @Get('dashboard-bodega/pedidos-pendientes')
  @Permissions('despachos', 'ver')
  pedidosPendientes() { return this.srv.pedidosPendientes(); }

  @Get('despachos/pendientes')
  @Permissions('despachos', 'ver')
  pendientes() { return this.srv.pendientes(); }

  @Post('despachos')
  @Permissions('despachos', 'crear')
  create(@Body() dto: CreateDespachoDto) { return this.srv.create(dto); }
}
