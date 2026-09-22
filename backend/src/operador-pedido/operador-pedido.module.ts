import { Module } from '@nestjs/common';
import { OperadorPedidoService } from './operador-pedido.service';
import { OperadorPedidoController } from './operador-pedido.controller';

@Module({ controllers: [OperadorPedidoController], providers: [OperadorPedidoService] })
export class OperadorPedidoModule {}
