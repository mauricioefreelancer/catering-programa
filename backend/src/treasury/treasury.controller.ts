import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { CreateEfectivoNrDto, CompletarEfectivoNrDto, CreateSaldoDigitalDto, UpdateSaldoDigitalDto, QueryFacturacionNrqDto } from './dto/treasury.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('tesoreria')
@UseGuards(AuthGuard('jwt'))
export class TreasuryController {
  constructor(private readonly srv: TreasuryService) {}

  @Post('efectivo-nr')
  @Permissions('tesoreria', 'crear')
  createEfectivoNr(@Body() dto: CreateEfectivoNrDto) { return this.srv.createEfectivoNr(dto); }

  @Get('efectivo-nr/visitas')
  @Permissions('tesoreria', 'ver')
  listarVisitasRecaudo(@Query() q: any) { return this.srv.listarVisitasRecaudo(q); }

  @Patch('efectivo-nr/:id')
  @Permissions('tesoreria', 'editar')
  updateEfectivoNr(@Param('id') id: string, @Body() dto: CompletarEfectivoNrDto) { return this.srv.updateEfectivoNr(+id, dto); }

  @Delete('efectivo-nr/:id')
  @Permissions('tesoreria', 'eliminar')
  removeEfectivoNr(@Param('id') id: string) { return this.srv.removeEfectivoNr(+id); }

  @Get('saldos-digitales')
  @Permissions('tesoreria', 'ver')
  findAllSaldos() { return this.srv.findAllSaldos(); }

  @Post('saldos-digitales')
  @Permissions('tesoreria', 'crear')
  createSaldo(@Body() dto: CreateSaldoDigitalDto) { return this.srv.createSaldo(dto); }

  @Patch('saldos-digitales/:id')
  @Permissions('tesoreria', 'editar')
  updateSaldo(@Param('id') id: string, @Body() dto: UpdateSaldoDigitalDto) { return this.srv.updateSaldo(+id, dto); }

  @Delete('saldos-digitales/:id')
  @Permissions('tesoreria', 'eliminar')
  removeSaldo(@Param('id') id: string) { return this.srv.removeSaldo(+id); }

  @Get('facturacion-nrq')
  @Permissions('tesoreria', 'ver')
  facturacionNrq(@Query() q: QueryFacturacionNrqDto) { return this.srv.facturacionNrq(q); }

  @Get('vendido-por-visita')
  @Permissions('tesoreria', 'ver')
  vendidoPorVisita(@Query() q: any) { return this.srv.vendidoPorVisita(q); }
}
