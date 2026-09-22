import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateIngresoDto, QueryIngresoDto } from './dto/inventory.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private readonly srv: InventoryService) {}

  @Get('ingresos-bodega') @Permissions('inventario', 'ver') findAll(@Query() q: QueryIngresoDto) { return this.srv.findAll(q); }
  @Get('ingresos-bodega/:id') @Permissions('inventario', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post('ingresos-bodega') @Permissions('inventario', 'crear') create(@Body() dto: CreateIngresoDto) { return this.srv.create(dto); }
}
