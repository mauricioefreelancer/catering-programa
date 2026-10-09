import { Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { OperadorPedidoService } from './operador-pedido.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('pedidos-operador')
@UseGuards(AuthGuard('jwt'))
export class OperadorPedidoController {
  constructor(private readonly srv: OperadorPedidoService) {}

  @Get()
  @Permissions('pedidosOperador', 'ver')
  findAll(
    @Query('idOperador') idOperador?: string,
    @Query('idMaquina') idMaquina?: string,
    @Query('estado') estado?: string,
  ) {
    return this.srv.findAll({
      idOperador: idOperador ? Number(idOperador) : undefined,
      idMaquina: idMaquina ? Number(idMaquina) : undefined,
      estado,
    });
  }

  @Post()
  @Permissions('pedidosOperador', 'crear')
  create(@Body() dto: CreatePedidoOperadorDto, @Req() req: Request) {
    return this.srv.create(dto, this.userId(req));
  }

  private userId(req: Request): number | null {
    const u = (req as any).user as any;
    return u && typeof u.sub === 'number' ? u.sub : null;
  }
}
