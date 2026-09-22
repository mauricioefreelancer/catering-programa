import { Module } from '@nestjs/common';
import { PreciosClienteService } from './precios-cliente.service';
import { PreciosClienteController } from './precios-cliente.controller';

@Module({ controllers: [PreciosClienteController], providers: [PreciosClienteService] })
export class PreciosClienteModule {}
