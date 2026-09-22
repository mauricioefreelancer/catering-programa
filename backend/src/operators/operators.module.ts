import { Module } from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { OperatorsController } from './operators.controller';

@Module({ controllers: [OperatorsController], providers: [OperatorsService] })
export class OperatorsModule {}
