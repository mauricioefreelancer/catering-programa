import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './permissions.guard';

const SIGN_EXPIRES = (v: string) =>
  v as unknown as NonNullable<JwtSignOptions>['expiresIn'];
const SIGN_SECRET = (v: string | undefined) =>
  v as JwtSignOptions['secret'];

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validarPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async login(email: string, password: string) {
    const whereEmailOUsuario = [
      { email: email },
      { usuarioLogin: email },
    ];
    const usuario = await this.prisma.usuariosSistema.findFirst({
      where: { OR: whereEmailOUsuario },
      include: { rol: true },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const passwordValido = await this.validarPassword(password, usuario.passwordHash);
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!usuario.estado) {
      throw new UnauthorizedException('Usuario inactivo');
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

    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      email: usuario.email,
      idRol: usuario.idRol,
      permisos: merged,
    };

    await this.prisma.usuariosSistema.update({
      where: { idUsuario: usuario.idUsuario },
      data: { ultimoAcceso: new Date() },
    });

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: SIGN_SECRET(process.env.JWT_SECRET),
        expiresIn: SIGN_EXPIRES(process.env.JWT_EXPIRES_IN || '7d'),
      }),
      refreshToken: this.jwtService.sign(payload, {
        secret: SIGN_SECRET(process.env.JWT_SECRET),
        expiresIn: SIGN_EXPIRES('30d'),
      }),
      usuario: {
        idUsuario: usuario.idUsuario,
        id: usuario.idUsuario,
        nombreCompleto: usuario.nombreCompleto,
        nombre: usuario.nombreCompleto,
        email: usuario.email,
        usuarioLogin: usuario.usuarioLogin,
        usuario_login: usuario.usuarioLogin,
        idRol: usuario.idRol,
        rol: usuario.rol.nombreRol,
        rolNombre: usuario.rol.nombreRol,
        perfil: usuario.rol.nombreRol.includes('Administrador') || usuario.rol.nombreRol.includes('Gerencia') || usuario.rol.nombreRol.includes('Desarrollador') ? 'GERENCIA' : usuario.rol.nombreRol.includes('Megacuadro') ? 'MEGACUADRO' : usuario.rol.nombreRol.includes('Bodega') ? 'BODEGA' : usuario.rol.nombreRol.includes('Tesoreria') ? 'TESORERIA' : usuario.rol.nombreRol.includes('Operador') ? 'OPERADOR' : 'USUARIO',
        permisos: merged,
        excepciones_permisos: excepciones,
      },
    };
  }

  async refreshToken(refresh: string) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refresh, { secret: process.env.JWT_SECRET });
    } catch (e) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const usuario = await this.prisma.usuariosSistema.findUnique({
      where: { idUsuario: decoded.sub },
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
    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      email: usuario.email,
      idRol: usuario.idRol,
      permisos: merged,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: SIGN_SECRET(process.env.JWT_SECRET),
        expiresIn: SIGN_EXPIRES(process.env.JWT_EXPIRES_IN || '7d'),
      }),
    };
  }
}
