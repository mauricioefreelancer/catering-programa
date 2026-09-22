import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { ConfigModule } from '@nestjs/config';

const JWT_CFG = {
  secret: (process.env.JWT_SECRET || 'cambiar_esta_clave_segura_en_produccion') as JwtModuleOptions['secret'],
  signOptions: {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as unknown as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
  },
} satisfies JwtModuleOptions;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.register(JWT_CFG),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsGuard],
  exports: [AuthService, PermissionsGuard, JwtModule],
})
export class AuthModule {}
