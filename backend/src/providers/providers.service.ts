import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto, UpdateProveedorDto, QueryProveedorDto } from './dto/proveedor.dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryProveedorDto) {
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
      this.prisma.proveedores.findMany({ skip, take, where, orderBy: { fechaCreacion: 'desc' } }),
      this.prisma.proveedores.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: number) {
    const p = await this.prisma.proveedores.findUnique({ where: { idProveedor: id } });
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    return p;
  }

  create(dto: CreateProveedorDto) {
    return this.prisma.proveedores.create({ data: dto });
  }

  async update(id: number, dto: UpdateProveedorDto) {
    await this.findOne(id);
    return this.prisma.proveedores.update({ where: { idProveedor: id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.proveedores.delete({ where: { idProveedor: id } });
  }
}
