import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MachinesService } from './machines.service';
import {
  CreateMaquinaDto, UpdateMaquinaDto, AsignarMaquinaDto,
  CreateMapaMPDto, UpdateMapaMPDto, CreateMapaNRQDto, UpdateMapaNRQDto, QueryMaquinaDto,
} from './dto/maquina.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('maquinas')
@UseGuards(AuthGuard('jwt'))
export class MachinesController {
  constructor(private readonly srv: MachinesService) {}

  @Get() @Permissions('maquinas', 'ver') findAll(@Query() q: QueryMaquinaDto) { return this.srv.findAll(q); }
  @Get(':id') @Permissions('maquinas', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post() @Permissions('maquinas', 'crear') create(@Body() dto: CreateMaquinaDto) { return this.srv.create(dto); }
  @Patch(':id') @Permissions('maquinas', 'editar') update(@Param('id') id: string, @Body() dto: UpdateMaquinaDto) { return this.srv.update(+id, dto); }
  @Delete(':id') @Permissions('maquinas', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
  @Patch(':id/asignar') @Permissions('maquinas', 'editar') asignar(@Param('id') id: string, @Body() dto: AsignarMaquinaDto) { return this.srv.asignar(+id, dto); }

  @Get(':id/mapa-mp') @Permissions('maquinas', 'ver') getMapaMP(@Param('id') id: string) { return this.srv.getMapaMP(+id); }
  @Post(':id/mapa-mp') @Permissions('maquinas', 'crear') addMapaMP(@Param('id') id: string, @Body() dto: CreateMapaMPDto) { return this.srv.addMapaMP(+id, dto); }
  @Patch(':id/mapa-mp/:idMapa') @Permissions('maquinas', 'editar') updateMapaMP(@Param('id') id: string, @Param('idMapa') idMapa: string, @Body() dto: UpdateMapaMPDto) { return this.srv.updateMapaMP(+id, +idMapa, dto); }
  @Delete(':id/mapa-mp/:idMapa') @Permissions('maquinas', 'eliminar') removeMapaMP(@Param('id') id: string, @Param('idMapa') idMapa: string) { return this.srv.removeMapaMP(+id, +idMapa); }

  @Get(':id/mapa-nrq') @Permissions('maquinas', 'ver') getMapaNRQ(@Param('id') id: string) { return this.srv.getMapaNRQ(+id); }
  @Post(':id/mapa-nrq') @Permissions('maquinas', 'crear') addMapaNRQ(@Param('id') id: string, @Body() dto: CreateMapaNRQDto) { return this.srv.addMapaNRQ(+id, dto); }
  @Patch(':id/mapa-nrq/:idMapa') @Permissions('maquinas', 'editar') updateMapaNRQ(@Param('id') id: string, @Param('idMapa') idMapa: string, @Body() dto: UpdateMapaNRQDto) { return this.srv.updateMapaNRQ(+id, +idMapa, dto); }
  @Delete(':id/mapa-nrq/:idMapa') @Permissions('maquinas', 'eliminar') removeMapaNRQ(@Param('id') id: string, @Param('idMapa') idMapa: string) { return this.srv.removeMapaNRQ(+id, +idMapa); }
}
