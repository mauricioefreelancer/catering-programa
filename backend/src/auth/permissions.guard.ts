import { Injectable, CanActivate, ExecutionContext, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (modulo: string, accion: string) =>
  SetMetadata(PERMISSIONS_KEY, { modulo, accion });

export interface JwtPayload {
  sub: number;
  email: string;
  idRol: number;
  permisos: Record<string, Record<string, boolean>>;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Formato de token inválido');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET }) as JwtPayload;
    } catch (e) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    request.user = payload;

    const required = this.reflector.get<{ modulo: string; accion: string }>(PERMISSIONS_KEY, context.getHandler());
    if (!required) {
      return true;
    }

    const permisos = payload.permisos || {};
    const moduloPermisos = permisos[required.modulo];
    if (!moduloPermisos || !moduloPermisos[required.accion]) {
      throw new ForbiddenException(`No tiene permiso para ${required.accion} en ${required.modulo}`);
    }
    return true;
  }
}
