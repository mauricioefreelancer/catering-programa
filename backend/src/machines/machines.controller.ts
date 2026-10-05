import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
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
  @Post() @Permissions('maquinas', 'crear') create(@Body() dto: CreateMaquinaDto, @Req() req: Request) { return this.srv.create(dto, this.userId(req), this.clientIp(req)); }
  @Patch(':id') @Permissions('maquinas', 'editar') update(@Param('id') id: string, @Body() dto: UpdateMaquinaDto, @Req() req: Request) { return this.srv.update(+id, dto, this.userId(req), this.clientIp(req)); }
  @Delete(':id') @Permissions('maquinas', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
  @Patch(':id/asignar') @Permissions('maquinas', 'editar') asignar(@Param('id') id: string, @Body() dto: AsignarMaquinaDto, @Req() req: Request) { return this.srv.asignar(+id, dto, this.userId(req)); }

  private userId(req: Request): number | null {
    const u = (req as any).user as any;
    return u && typeof u.sub === 'number' ? u.sub : null;
  }

  private clientIp(req: Request): string | null {
    const u = (req as any).user as any;
    const xff = req.headers?.['x-forwarded-for'];
    const ip = (Array.isArray(xff) ? xff[0] : xff) || req.ip || '';
    return String(ip).split(',')[0].trim() || null;
  }

  @Get(':id/mapa-mp') @Permissions('maquinas', 'ver') getMapaMP(@Param('id') id: string) { return this.srv.getMapaMP(+id); }
  @Post(':id/mapa-mp') @Permissions('maquinas', 'crear') addMapaMP(@Param('id') id: string, @Body() dto: CreateMapaMPDto) { return this.srv.addMapaMP(+id, dto); }
  @Patch(':id/mapa-mp/:idMapa') @Permissions('maquinas', 'editar') updateMapaMP(@Param('id') id: string, @Param('idMapa') idMapa: string, @Body() dto: UpdateMapaMPDto) { return this.srv.updateMapaMP(+id, +idMapa, dto); }
  @Delete(':id/mapa-mp/:idMapa') @Permissions('maquinas', 'eliminar') removeMapaMP(@Param('id') id: string, @Param('idMapa') idMapa: string) { return this.srv.removeMapaMP(+id, +idMapa); }

  @Post(':id/espirales') @Permissions('maquinas', 'editar') saveEspirales(@Param('id') id: string, @Body() body: any) { return this.srv.saveMapaEspirales(+id, body?.espirales); }
  @Post(':id/botones') @Permissions('maquinas', 'editar') saveBotones(@Param('id') id: string, @Body() body: any) { return this.srv.saveMapaBotones(+id, body?.botones); }

  @Get(':id/mapa-nrq') @Permissions('maquinas', 'ver') getMapaNRQ(@Param('id') id: string) { return this.srv.getMapaNRQ(+id); }
  @Post(':id/mapa-nrq') @Permissions('maquinas', 'crear') addMapaNRQ(@Param('id') id: string, @Body() dto: CreateMapaNRQDto) { return this.srv.addMapaNRQ(+id, dto); }
  @Patch(':id/mapa-nrq/:idMapa') @Permissions('maquinas', 'editar') updateMapaNRQ(@Param('id') id: string, @Param('idMapa') idMapa: string, @Body() dto: UpdateMapaNRQDto) { return this.srv.updateMapaNRQ(+id, +idMapa, dto); }
  @Delete(':id/mapa-nrq/:idMapa') @Permissions('maquinas', 'eliminar') removeMapaNRQ(@Param('id') id: string, @Param('idMapa') idMapa: string) { return this.srv.removeMapaNRQ(+id, +idMapa); }

  @Get(':id/rendimiento') @Permissions('maquinas', 'ver') rendimiento(@Param('id') id: string) { return this.srv.rendimiento(+id); }

  @Get('historial/medios-pago') @Permissions('maquinas', 'ver')
  historial(@Query() q: { maquinaId?: string; serial?: string; fechaDesde?: string; fechaHasta?: string }) {
    return this.srv.historialMediosPago(q);
  }
}
