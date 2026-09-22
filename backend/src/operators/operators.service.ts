import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperadorDto, UpdateOperadorDto, QueryOperadorDto } from './dto/operador.dto';
import * as bcrypt from 'bcrypt';

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
    const exists = await this.prisma.usuariosSistema.findFirst({
      where: { OR: [{ email: dto.email }, { usuarioLogin: dto.usuarioLogin }] },
    });
    if (exists) throw new ConflictException('Email o usuario ya existen');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuariosSistema.create({
        data: {
          idRol: dto.idRol,
          nombreCompleto: dto.nombreCompleto,
          usuarioLogin: dto.usuarioLogin,
          email: dto.email,
          passwordHash,
        },
      });
      const operador = await tx.operadores.create({
        data: {
          idUsuario: usuario.idUsuario,
          nombreCompleto: dto.nombreCompleto,
          telefono: dto.telefono,
          zonaAsignada: dto.zonaAsignada,
          fechaIngreso: dto.fechaIngreso ? new Date(dto.fechaIngreso) : new Date(),
          estado: dto.estado ?? true,
        },
      });
      return { operador, usuario };
    });
  }

  async update(id: number, dto: UpdateOperadorDto) {
    const op = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const userData: any = {};
      if (dto.idRol) userData.idRol = dto.idRol;
      if (dto.email) userData.email = dto.email;
      if (dto.usuarioLogin) userData.usuarioLogin = dto.usuarioLogin;
      if (dto.nombreCompleto) userData.nombreCompleto = dto.nombreCompleto;
      if (dto.password) userData.passwordHash = await bcrypt.hash(dto.password, 10);
      if (Object.keys(userData).length > 0) {
        await tx.usuariosSistema.update({ where: { idUsuario: op.idUsuario }, data: userData });
      }
      const opData: any = {};
      if (dto.nombreCompleto) opData.nombreCompleto = dto.nombreCompleto;
      if (dto.telefono !== undefined) opData.telefono = dto.telefono;
      if (dto.zonaAsignada !== undefined) opData.zonaAsignada = dto.zonaAsignada;
      if (dto.fechaIngreso) opData.fechaIngreso = new Date(dto.fechaIngreso);
      if (dto.estado !== undefined) opData.estado = dto.estado;
      return tx.operadores.update({ where: { idOperador: id }, data: opData, include: { usuario: true } });
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.operadores.delete({ where: { idOperador: id } });
  }
}
