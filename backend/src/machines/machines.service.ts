import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaquinaDto, UpdateMaquinaDto, AsignarMaquinaDto,
  CreateMapaMPDto, UpdateMapaMPDto, CreateMapaNRQDto, UpdateMapaNRQDto, QueryMaquinaDto,
} from './dto/maquina.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryMaquinaDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { serial: { contains: query.search, mode: 'insensitive' } },
        { ubicacionEsp: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.tipo) where.tipo = query.tipo;
    const [data, total] = await Promise.all([
      this.prisma.maquinasYTiendas.findMany({
        skip, take, where, include: { cliente: true, operador: true }, orderBy: { fechaCreacion: 'desc' },
      }),
      this.prisma.maquinasYTiendas.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const m = await this.prisma.maquinasYTiendas.findUnique({
      where: { idMaquina: id },
      include: {
        cliente: true, operador: true,
        mapaMateriaPrima: { include: { producto: true } },
        mapaCafeNrq: { include: { productoTerminado: true } },
      },
    });
    if (!m) throw new NotFoundException('Máquina no encontrada');
    return m;
  }

  async create(dto: CreateMaquinaDto) {
    const data: any = { ...dto };
    if (dto.fechaInstalacion) data.fechaInstalacion = new Date(dto.fechaInstalacion);
    if (dto.tarifaPromedioOverride !== undefined) data.tarifaPromedioOverride = new Prisma.Decimal(dto.tarifaPromedioOverride);
    return this.prisma.maquinasYTiendas.create({ data });
  }

  async update(id: number, dto: UpdateMaquinaDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.fechaInstalacion) data.fechaInstalacion = new Date(dto.fechaInstalacion);
    if (dto.tarifaPromedioOverride !== undefined) data.tarifaPromedioOverride = new Prisma.Decimal(dto.tarifaPromedioOverride);
    return this.prisma.maquinasYTiendas.update({ where: { idMaquina: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.maquinasYTiendas.delete({ where: { idMaquina: id } });
  }

  async asignar(id: number, dto: AsignarMaquinaDto) {
    await this.findOne(id);
    return this.prisma.maquinasYTiendas.update({ where: { idMaquina: id }, data: dto });
  }

  async getMapaMP(id: number) {
    await this.findOne(id);
    return this.prisma.mapaMateriaPrima.findMany({ where: { idMaquina: id }, include: { producto: true }, orderBy: { espiralCodigo: 'asc' } });
  }

  async addMapaMP(id: number, dto: CreateMapaMPDto) {
    await this.findOne(id);
    return this.prisma.mapaMateriaPrima.create({
      data: { idMaquina: id, idProducto: dto.idProducto, espiralCodigo: dto.espiralCodigo, capacidadMax: dto.capacidadMax ?? 0 },
    });
  }

  async updateMapaMP(id: number, idMapa: number, dto: UpdateMapaMPDto) {
    const m = await this.prisma.mapaMateriaPrima.findUnique({ where: { idMapaMp: idMapa } });
    if (!m || m.idMaquina !== id) throw new NotFoundException('Mapa MP no encontrado');
    return this.prisma.mapaMateriaPrima.update({ where: { idMapaMp: idMapa }, data: dto });
  }

  async removeMapaMP(id: number, idMapa: number) {
    const m = await this.prisma.mapaMateriaPrima.findUnique({ where: { idMapaMp: idMapa } });
    if (!m || m.idMaquina !== id) throw new NotFoundException('Mapa MP no encontrado');
    return this.prisma.mapaMateriaPrima.delete({ where: { idMapaMp: idMapa } });
  }

  async getMapaNRQ(id: number) {
    const maq = await this.findOne(id);
    if (maq.tipo !== 'CAFE') throw new BadRequestException('La máquina debe ser de tipo CAFE');
    return this.prisma.mapaCafeNrq.findMany({ where: { idMaquina: id }, include: { productoTerminado: true }, orderBy: { opcionBoton: 'asc' } });
  }

  async addMapaNRQ(id: number, dto: CreateMapaNRQDto) {
    const maq = await this.findOne(id);
    if (maq.tipo !== 'CAFE') throw new BadRequestException('La máquina debe ser de tipo CAFE');
    return this.prisma.mapaCafeNrq.create({
      data: { idMaquina: id, idProdTerm: dto.idProdTerm, opcionBoton: dto.opcionBoton },
    });
  }

  async updateMapaNRQ(id: number, idMapa: number, dto: UpdateMapaNRQDto) {
    const maq = await this.findOne(id);
    if (maq.tipo !== 'CAFE') throw new BadRequestException('La máquina debe ser de tipo CAFE');
    const m = await this.prisma.mapaCafeNrq.findUnique({ where: { idMapaNrq: idMapa } });
    if (!m || m.idMaquina !== id) throw new NotFoundException('Mapa NRQ no encontrado');
    return this.prisma.mapaCafeNrq.update({ where: { idMapaNrq: idMapa }, data: dto });
  }

  async removeMapaNRQ(id: number, idMapa: number) {
    const maq = await this.findOne(id);
    if (maq.tipo !== 'CAFE') throw new BadRequestException('La máquina debe ser de tipo CAFE');
    const m = await this.prisma.mapaCafeNrq.findUnique({ where: { idMapaNrq: idMapa } });
    if (!m || m.idMaquina !== id) throw new NotFoundException('Mapa NRQ no encontrado');
    return this.prisma.mapaCafeNrq.delete({ where: { idMapaNrq: idMapa } });
  }
}
