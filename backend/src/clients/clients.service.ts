import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, UpdateClienteDto, QueryClienteDto } from './dto/cliente.dto';

const firstNonEmpty = (...vals: any[]): any => {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

function normalizeClienteInput(dto: CreateClienteDto | UpdateClienteDto, isUpdate: boolean = false) {
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
  const fechaContratoRaw = firstNonEmpty(dto.fechaContrato, dto.fecha_contrato, (dto as any).fecha);
  let fechaContratoDate: Date | undefined = undefined;
  let fechaFueEnviada = false;
  if (fechaContratoRaw !== undefined && fechaContratoRaw !== null && String(fechaContratoRaw).trim() !== '') {
    fechaFueEnviada = true;
    try {
      const str = String(fechaContratoRaw).trim();
      let yy: number | undefined, mm: number | undefined, dd: number | undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-').map(Number);
        yy = y; mm = m; dd = d;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [d, m, y] = str.split('/').map(Number);
        yy = y; mm = m; dd = d;
      } else {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          yy = d.getUTCFullYear();
          mm = d.getUTCMonth() + 1;
          dd = d.getUTCDate();
        }
      }
      if (yy !== undefined && mm !== undefined && dd !== undefined
        && yy >= 1900 && yy <= 2999 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        fechaContratoDate = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
      }
    } catch {
      fechaContratoDate = undefined;
    }
  }
  const result: any = {};
  if (nit !== undefined) result.nit = String(nit).slice(0, 30);
  if (razonSocial !== undefined) result.razonSocial = String(razonSocial).slice(0, 250);
  if (contactoNombre !== undefined) result.contactoNombre = String(contactoNombre).slice(0, 200);
  if (contactoTelefono !== undefined) result.contactoTelefono = String(contactoTelefono).slice(0, 50);
  if (contactoCorreo !== undefined) result.contactoCorreo = String(contactoCorreo).slice(0, 200);
  if (contactoDireccion !== undefined) result.contactoDireccion = String(contactoDireccion).slice(0, 300);
  if (contactoCiudad !== undefined) result.contactoCiudad = String(contactoCiudad).slice(0, 100);
  if (fechaContratoDate !== undefined) {
    result.fechaContrato = fechaContratoDate;
  } else if (!isUpdate) {
    if (!fechaFueEnviada) {
      try {
        const ahora = new Date();
        result.fechaContrato = new Date(Date.UTC(
          ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0,
        ));
      } catch {}
    }
  }
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
    const data = normalizeClienteInput(dto, false);
    if (!data.razonSocial) data.razonSocial = `Cliente ${data.nit || new Date().getTime()}`;
    if (!data.nit) data.nit = `${new Date().getTime()}`.slice(0, 30);
    data.estado = data.estado ?? true;
    return this.prisma.clientes.create({ data });
  }

  async update(id: number, dto: UpdateClienteDto) {
    await this.findOne(id);
    const data = normalizeClienteInput(dto, true);
    return this.prisma.clientes.update({ where: { idCliente: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.clientes.delete({ where: { idCliente: id } });
  }
}

