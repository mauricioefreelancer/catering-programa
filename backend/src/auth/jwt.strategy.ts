import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './permissions.guard';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'cambiar_esta_clave_segura_en_produccion',
    });
  }

  async validate(payload: any): Promise<JwtPayload> {
    const usuario = await this.prisma.usuariosSistema.findUnique({
      where: { idUsuario: payload.sub },
      include: { rol: true },
    });
    if (!usuario || !usuario.estado) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    const permisosRol = (usuario.rol.permisosCrud || {}) as Record<string, Record<string, boolean>>;
    const excepciones = (usuario.permisosExcepcion || {}) as Record<string, Record<string, boolean>>;
    const merged: Record<string, Record<string, boolean>> = {};
    for (const m of Object.keys(permisosRol)) {
      merged[m] = { ...permisosRol[m] };
    }
    for (const m of Object.keys(excepciones)) {
      merged[m] = { ...(merged[m] || {}), ...excepciones[m] };
    }
    return {
      sub: usuario.idUsuario,
      email: usuario.email,
      idRol: usuario.idRol,
      permisos: merged,
    };
  }
}
