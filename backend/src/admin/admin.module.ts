import { Global, Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ParametrosService } from './parametros.service';

@Global()
@Module({ controllers: [AdminController], providers: [AdminService, ParametrosService], exports: [ParametrosService] })
export class AdminModule {}
