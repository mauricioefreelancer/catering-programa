import { Module } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { MachinesController } from './machines.controller';
import { RecetasCafeModule } from '../recetas-cafe/recetas-cafe.module';

@Module({ imports: [RecetasCafeModule], controllers: [MachinesController], providers: [MachinesService] })
export class MachinesModule {}
