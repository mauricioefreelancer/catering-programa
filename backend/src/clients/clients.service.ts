import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, UpdateClienteDto, QueryClienteDto } from './dto/cliente.dto';

const firstNonEmpty = (...vals: any[]): any => {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

function normalizeClienteInput(dto: CreateClienteDto | UpdateClienteDto) {
  const nombres = firstNonEmpty(dto.nombres, dto.contacto, dto.contactoNombre);
  const apellidos = firstNonEmpty(dto.apellidos);
  const razonSocial = firstNonEmpty(dto.razonSocial, dto.razon_social,
    (nombres ? [nombres, apellidos].filter(Boolean).join(' ') : undefined));
  const nit = firstNonEmpty(dto.nit, dto.NIT, dto.identificacion,
    (dto.tipo_identificacion && dto.identificacion ? `${dto.tipo_identificacion}-${dto.identificacion}` : undefined));
  const contactoNombre = firstNonEmpty(dto.contactoNombre, dto.contacto, dto.nombres);
  const contactoTelefono = firstNonEmpty(dto.contactoTelefono, dto.telefono);
  const contactoCorreo = firstNonEmpty(dto.contactoCorreo, dto.email);
  const contactoDireccion = firstNonEmpty(dto.contactoDireccion, dto.direccion);
  const contactoCiudad = firstNonEmpty(dto.contactoCiudad, dto.ciudad);
  const fechaContrato = firstNonEmpty(dto.fechaContrato, dto.fecha_contrato);
  const result: any = {};
  if (nit !== undefined) result.nit = String(nit).slice(0, 30);
  if (razonSocial !== undefined) result.razonSocial = String(razonSocial).slice(0, 250);
  if (contactoNombre !== undefined) result.contactoNombre = String(contactoNombre).slice(0, 200);
  if (contactoTelefono !== undefined) result.contactoTelefono = String(contactoTelefono).slice(0, 50);
  if (contactoCorreo !== undefined) result.contactoCorreo = String(contactoCorreo).slice(0, 200);
  if (contactoDireccion !== undefined) result.contactoDireccion = String(contactoDireccion).slice(0, 300);
  if (contactoCiudad !== undefined) result.contactoCiudad = String(contactoCiudad).slice(0, 100);
  if (fechaContrato !== undefined) result.fechaContrato = new Date(fechaContrato);
  else if (dto instanceof CreateClienteDto || !(dto as any).idCliente) result.fechaContrato = new Date();
  if (typeof dto.estado === 'boolean') result.estado = dto.estado;
  return result;
}

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
        { contactoNombre: { contains: query.search, mode: 'insensitive' } },
        { contactoCiudad: { contains: query.search, mode: 'insensitive' } },
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
    const data = normalizeClienteInput(dto);
    if (!data.razonSocial) data.razonSocial = `Cliente ${data.nit || new Date().getTime()}`;
    if (!data.nit) data.nit = `${new Date().getTime()}`.slice(0, 30);
    data.estado = data.estado ?? true;
    return this.prisma.clientes.create({ data });
  }

  async update(id: number, dto: UpdateClienteDto) {
    await this.findOne(id);
    const data = normalizeClienteInput(dto);
    return this.prisma.clientes.update({ where: { idCliente: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.clientes.delete({ where: { idCliente: id } });
  }
}

