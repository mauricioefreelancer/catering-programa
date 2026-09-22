import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, UpdateClienteDto, QueryClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryClienteDto) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const take = query.take ? parseInt(query.take) : 50;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { razonSocial: { contains: query.search, mode: 'insensitive' } },
        { nit: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.clientes.findMany({
        skip,
        take,
        where,
        orderBy: { fechaCreacion: 'desc' },
      }),
      this.prisma.clientes.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const cliente = await this.prisma.clientes.findUnique({ where: { idCliente: id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async getMatrizPrecios(id: number) {
    await this.findOne(id);
    return this.prisma.preciosCliente.findMany({
      where: { idCliente: id },
      include: { producto: true },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async create(dto: CreateClienteDto) {
    return this.prisma.clientes.create({
      data: {
        ...dto,
        fechaContrato: new Date(dto.fechaContrato),
      },
    });
  }

  async update(id: number, dto: UpdateClienteDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.fechaContrato) data.fechaContrato = new Date(dto.fechaContrato);
    return this.prisma.clientes.update({ where: { idCliente: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.clientes.delete({ where: { idCliente: id } });
  }
}
