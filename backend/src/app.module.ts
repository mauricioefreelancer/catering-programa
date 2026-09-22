import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ProvidersModule } from './providers/providers.module';
import { OperatorsModule } from './operators/operators.module';
import { ProductsModule } from './products/products.module';
import { PreciosClienteModule } from './precios-cliente/precios-cliente.module';
import { MachinesModule } from './machines/machines.module';
import { InventoryModule } from './inventory/inventory.module';
import { OperadorPedidoModule } from './operador-pedido/operador-pedido.module';
import { DespachosModule } from './despachos/despachos.module';
import { TreasuryModule } from './treasury/treasury.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditMiddleware } from './common/audit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 300,
      },
    ]),
    PrismaModule,
    AuthModule,
    ClientsModule,
    ProvidersModule,
    OperatorsModule,
    ProductsModule,
    PreciosClienteModule,
    MachinesModule,
    InventoryModule,
    OperadorPedidoModule,
    DespachosModule,
    TreasuryModule,
    AdminModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
