import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperadorDto, UpdateOperadorDto, QueryOperadorDto } from './dto/operador.dto';
import * as bcrypt from 'bcrypt';

function firstNonEmpty(...vals: any[]): any {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    return v;
  }
  return undefined;
}

function normalizeOperadorInputLegacy(dto: CreateOperadorDto | UpdateOperadorDto) {
  const nombreCompleto = firstNonEmpty(dto.nombreCompleto, dto.nombre);
  const usuarioLogin = firstNonEmpty(dto.usuarioLogin, dto.usuario_login);
  const zonaAsignada = firstNonEmpty(dto.zonaAsignada, dto.zona);
  let idRol = firstNonEmpty(dto.idRol, dto.id_rol);
  if (idRol !== undefined && typeof idRol !== 'number') {
    const parsed = Number(idRol);
    if (!isNaN(parsed)) idRol = parsed; else idRol = undefined;
  }
  let idUsuario = firstNonEmpty(dto.idUsuario);
  if (idUsuario !== undefined && typeof idUsuario !== 'number') {
    const parsed = Number(idUsuario);
    if (!isNaN(parsed)) idUsuario = parsed; else idUsuario = undefined;
  }
  const estado = firstNonEmpty(dto.estado, true);
  const email = firstNonEmpty(dto.email);
  const password = firstNonEmpty(dto.password);
  const telefono = firstNonEmpty(dto.telefono);
  const fechaIngreso = firstNonEmpty(dto.fechaIngreso);
  return { nombreCompleto, usuarioLogin, zonaAsignada, idRol, idUsuario, estado, email, password, telefono, fechaIngreso };
}

@Injectable()
export class OperatorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryOperadorDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) {
      where.nombreCompleto = { contains: query.search, mode: 'insensitive' };
    }
    const [data, total] = await Promise.all([
      this.prisma.operadores.findMany({
        skip, take, where, orderBy: { fechaIngreso: 'desc' },
        include: { usuario: true },
      }),
      this.prisma.operadores.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const o = await this.prisma.operadores.findUnique({
      where: { idOperador: id },
      include: { usuario: true },
    });
    if (!o) throw new NotFoundException('Operador no encontrado');
    return o;
  }

  async create(dto: CreateOperadorDto) {
    const norm = normalizeOperadorInputLegacy(dto);

    // ==========================================================
    // MODO 1 - FE CREACIÓN 2 PASOS (idUsuario definido, Paso 1 ya creó el UsuarioSistema)
    // ==========================================================
    if (norm.idUsuario && !norm.password && !norm.idRol) {
      const usuarioExiste = await this.prisma.usuariosSistema.findUnique({
        where: { idUsuario: norm.idUsuario },
      });
      if (!usuarioExiste) {
        throw new BadRequestException(`UsuarioSistema idUsuario=${norm.idUsuario} no existe. No se puede vincular Operador a un usuario no creado.`);
      }
      const yaTieneOperador = await this.prisma.operadores.findUnique({
        where: { idUsuario: norm.idUsuario },
        include: { usuario: true },
      });
      const nombreFinal = norm.nombreCompleto ?? usuarioExiste.nombreCompleto;
      if (!nombreFinal) {
        throw new BadRequestException('nombreCompleto o nombre es requerido (o debe existir en el UsuarioSistema vinculado).');
      }
      const dataOperador: any = {
        nombreCompleto: nombreFinal,
        telefono: norm.telefono ?? null,
        zonaAsignada: norm.zonaAsignada ?? null,
        fechaIngreso: norm.fechaIngreso ? new Date(norm.fechaIngreso) : new Date(),
        estado: norm.estado ?? true,
      };
      if (yaTieneOperador) {
        // IDEMPOTENTE (doble click Guardar o re-vincular huérfano): actualiza la fila Operador existente
        const opUpdated = await this.prisma.operadores.update({
          where: { idUsuario: norm.idUsuario },
          data: dataOperador,
          include: { usuario: true },
        });
        return { operador: opUpdated, usuario: opUpdated.usuario };
      }
      const op = await this.prisma.operadores.create({
        data: {
          idUsuario: norm.idUsuario,
          ...dataOperador,
        },
        include: { usuario: true },
      });
      return { operador: op, usuario: op.usuario };
    }

    // ==========================================================
    // MODO 2 - LEGACY (password + idRol definidos = crea usuario + operador en transaction)
    // ==========================================================
    const erroresLegacy: string[] = [];
    if (!norm.idRol) erroresLegacy.push('idRol es requerido (modo legacy)');
    if (!norm.nombreCompleto) erroresLegacy.push('nombreCompleto o nombre es requerido');
    if (!norm.usuarioLogin) erroresLegacy.push('usuarioLogin o usuario_login es requerido');
    if (!norm.email) erroresLegacy.push('email es requerido');
    if (!norm.password) erroresLegacy.push('password es requerido');
    if (erroresLegacy.length > 0) {
      throw new BadRequestException(erroresLegacy.join(', '));
    }
    const exists = await this.prisma.usuariosSistema.findFirst({
      where: { OR: [{ email: norm.email }, { usuarioLogin: norm.usuarioLogin }] },
    });
    if (exists) throw new ConflictException('Email o usuario ya existen');
    const passwordHash = await bcrypt.hash(norm.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuariosSistema.create({
        data: {
          idRol: norm.idRol,
          nombreCompleto: norm.nombreCompleto,
          usuarioLogin: norm.usuarioLogin,
          email: norm.email,
          passwordHash,
          estado: norm.estado ?? true,
        },
      });
      const operador = await tx.operadores.create({
        data: {
          idUsuario: usuario.idUsuario,
          nombreCompleto: norm.nombreCompleto,
          telefono: norm.telefono ?? null,
          zonaAsignada: norm.zonaAsignada ?? null,
          fechaIngreso: norm.fechaIngreso ? new Date(norm.fechaIngreso) : new Date(),
          estado: norm.estado ?? true,
        },
      });
      return { operador, usuario };
    });
  }

  async update(id: number, dto: UpdateOperadorDto) {
    const op = await this.findOne(id);
    const norm = normalizeOperadorInputLegacy(dto);
    return this.prisma.$transaction(async (tx) => {
      const userData: any = {};
      if (norm.idRol !== undefined) userData.idRol = norm.idRol;
      if (norm.email !== undefined) userData.email = norm.email;
      if (norm.usuarioLogin !== undefined) userData.usuarioLogin = norm.usuarioLogin;
      if (norm.nombreCompleto !== undefined) userData.nombreCompleto = norm.nombreCompleto;
      if (norm.estado !== undefined) userData.estado = norm.estado;
      if (norm.password) userData.passwordHash = await bcrypt.hash(norm.password, 10);
      if (Object.keys(userData).length > 0) {
        await tx.usuariosSistema.update({ where: { idUsuario: op.idUsuario }, data: userData });
      }
      const opData: any = {};
      if (norm.nombreCompleto !== undefined) opData.nombreCompleto = norm.nombreCompleto;
      if (norm.telefono !== undefined) opData.telefono = norm.telefono;
      if (norm.zonaAsignada !== undefined) opData.zonaAsignada = norm.zonaAsignada;
      if (norm.fechaIngreso) opData.fechaIngreso = new Date(norm.fechaIngreso);
      if (norm.estado !== undefined) opData.estado = norm.estado;
      return tx.operadores.update({ where: { idOperador: id }, data: opData, include: { usuario: true } });
    });
  }

  async remove(id: number) {
    const op = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const usuarioVinculado = await tx.usuariosSistema.findUnique({
        where: { idUsuario: op.idUsuario },
      });
      await tx.operadores.delete({ where: { idOperador: id } });
      // Si el usuario vinculado EXCLUSIVAMENTE era Rol Operador, lo borramos para NO dejar usuario huérfano zombie en Admin/Usuarios
      if (usuarioVinculado && Number(usuarioVinculado.idRol) === 4) {
        await tx.usuariosSistema.delete({ where: { idUsuario: op.idUsuario } });
      }
      return op;
    });
  }
}
