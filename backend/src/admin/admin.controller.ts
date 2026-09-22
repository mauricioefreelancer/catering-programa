import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseArrayPipe } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateRolDto, UpdateRolDto, CreateUsuarioDto, UpdateUsuarioDto, QueryAdminDto } from './dto/admin.dto';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private readonly srv: AdminService) {}

  @Get('roles') @Permissions('admin', 'ver') findAllRoles(@Query() q: QueryAdminDto) { return this.srv.findAllRoles(q); }
  @Get('roles/:id') @Permissions('admin', 'ver') findOneRol(@Param('id') id: string) { return this.srv.findOneRol(+id); }
  @Post('roles') @Permissions('admin', 'crear') createRol(@Body() dto: CreateRolDto) { return this.srv.createRol(dto); }
  @Patch('roles/:id') @Permissions('admin', 'editar') updateRol(@Param('id') id: string, @Body() dto: UpdateRolDto) { return this.srv.updateRol(+id, dto); }
  @Delete('roles/:id') @Permissions('admin', 'eliminar') removeRol(@Param('id') id: string) { return this.srv.removeRol(+id); }

  @Get('usuarios') @Permissions('admin', 'ver') findAllUsuarios(@Query() q: QueryAdminDto) { return this.srv.findAllUsuarios(q); }
  @Get('usuarios/:id') @Permissions('admin', 'ver') findOneUsuario(@Param('id') id: string) { return this.srv.findOneUsuario(+id); }
  @Post('usuarios') @Permissions('admin', 'crear') createUsuario(@Body() dto: CreateUsuarioDto) { return this.srv.createUsuario(dto); }
  @Patch('usuarios/:id') @Permissions('admin', 'editar') updateUsuario(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) { return this.srv.updateUsuario(+id, dto); }
  @Delete('usuarios/:id') @Permissions('admin', 'eliminar') removeUsuario(@Param('id') id: string) { return this.srv.removeUsuario(+id); }

  // =========== Panel de Datos Maestro =====================================
  @Get('tables') @Permissions('admin', 'ver') listTables() { return this.srv.listTables(); }

  @Get('tables/:name') @Permissions('admin', 'ver')
  selectTable(@Param('name') name: string, @Query() q: any) { return this.srv.selectTable(name, q); }

  @Post('tables/:name') @Permissions('admin', 'crear')
  insertRow(@Param('name') name: string, @Body() body: any) { return this.srv.insertRow(name, body); }

  @Patch('tables/:name') @Permissions('admin', 'editar')
  updateRow(@Param('name') name: string, @Body() body: { where: Record<string, any>; data: any }) {
    return this.srv.updateRow(name, body.where, body.data);
  }

  @Delete('tables/:name') @Permissions('admin', 'eliminar')
  deleteRow(@Param('name') name: string, @Query('where') whereStr: string) {
    let where: Record<string, any> = {};
    try { where = JSON.parse(Buffer.from(whereStr || 'e30=', 'base64').toString('utf8')); } catch { where = {}; }
    return this.srv.deleteRow(name, where);
  }
}
