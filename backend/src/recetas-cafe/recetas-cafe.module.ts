import { Module } from '@nestjs/common';
import { RecetasCafeController } from './recetas-cafe.controller';
import { RecetasCafeService } from './recetas-cafe.service';

@Module({ controllers: [RecetasCafeController], providers: [RecetasCafeService], exports: [RecetasCafeService] })
export class RecetasCafeModule {}
