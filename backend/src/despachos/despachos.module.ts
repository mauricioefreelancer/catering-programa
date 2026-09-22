import { Module } from '@nestjs/common';
import { DespachosService } from './despachos.service';
import { DespachosController } from './despachos.controller';

@Module({ controllers: [DespachosController], providers: [DespachosService] })
export class DespachosModule {}
