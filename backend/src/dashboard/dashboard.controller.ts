import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../auth/permissions.guard';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly srv: DashboardService) {}

  @Get('gerencia')
  @Permissions('dashboard', 'ver')
  gerencia() { return this.srv.gerencia(); }

  @Get('tesoreria')
  @Permissions('dashboard', 'ver')
  tesoreria() { return this.srv.tesoreria(); }

  @Get('bodega')
  @Permissions('dashboard', 'ver')
  bodega() { return this.srv.bodega(); }
}
