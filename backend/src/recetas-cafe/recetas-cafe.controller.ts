import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Permissions } from '../auth/permissions.guard';
import { RecetasCafeService } from './recetas-cafe.service';

const usuario = (req: Request) => {
  const u = (req as any).user;
  return u && typeof u.sub === 'number' ? u.sub : null;
};

@Controller('recetas-cafe')
@UseGuards(AuthGuard('jwt'))
export class RecetasCafeController {
  constructor(private readonly srv: RecetasCafeService) {}

  @Get('categorias') @Permissions('productos', 'ver') categorias() { return this.srv.categorias(); }

  @Get('estandar') @Permissions('productos', 'ver') estandar() { return this.srv.estandar(); }

  @Put('estandar/:idProducto/:variante') @Permissions('productos', 'editar')
  guardarEstandar(@Param('idProducto') id: string, @Param('variante') variante: string, @Body() body: any, @Req() req: Request) {
    return this.srv.guardarEstandar(+id, variante, body?.lineas, usuario(req));
  }

  @Post('estandar/:idProducto/:variante/aplicar') @Permissions('maquinas', 'editar')
  aplicarEstandar(@Param('idProducto') id: string, @Param('variante') variante: string, @Req() req: Request) {
    return this.srv.aplicarEstandar(+id, variante, usuario(req));
  }

  @Get('maquinas/:id') @Permissions('maquinas', 'ver') vista(@Param('id') id: string) { return this.srv.vistaCafetera(+id); }

  @Put('maquinas/:id/botones/:idMapaNrq') @Permissions('maquinas', 'editar')
  guardarBoton(@Param('id') id: string, @Param('idMapaNrq') boton: string, @Body() body: any, @Req() req: Request) {
    return this.srv.guardarRecetaBoton(+id, +boton, body ?? {}, usuario(req));
  }

  @Post('maquinas/:id/ajustar-insumo') @Permissions('maquinas', 'editar')
  ajustar(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.srv.ajustarInsumo(+id, body?.categoria, body?.cantidad, usuario(req));
  }

  @Post('maquinas/:id/restaurar') @Permissions('maquinas', 'editar')
  restaurar(@Param('id') id: string, @Req() req: Request) { return this.srv.restaurarMaquina(+id, usuario(req)); }

  @Get('maquinas/:id/control') @Permissions('maquinas', 'ver')
  control(@Param('id') id: string, @Query('fechaInicio') inicio?: string, @Query('fechaFin') fin?: string) {
    return this.srv.controlPeriodo(+id, inicio, fin);
  }
}
