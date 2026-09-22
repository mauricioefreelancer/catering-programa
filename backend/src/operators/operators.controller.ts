import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { CreateOperadorDto, UpdateOperadorDto, QueryOperadorDto } from './dto/operador.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('operadores')
@UseGuards(AuthGuard('jwt'))
export class OperatorsController {
  constructor(private readonly srv: OperatorsService) {}

  @Get() @Permissions('operadores', 'ver') findAll(@Query() q: QueryOperadorDto) { return this.srv.findAll(q); }
  @Get(':id') @Permissions('operadores', 'ver') findOne(@Param('id') id: string) { return this.srv.findOne(+id); }
  @Post() @Permissions('operadores', 'crear') create(@Body() dto: CreateOperadorDto) { return this.srv.create(dto); }
  @Patch(':id') @Permissions('operadores', 'editar') update(@Param('id') id: string, @Body() dto: UpdateOperadorDto) { return this.srv.update(+id, dto); }
  @Delete(':id') @Permissions('operadores', 'eliminar') remove(@Param('id') id: string) { return this.srv.remove(+id); }
}
