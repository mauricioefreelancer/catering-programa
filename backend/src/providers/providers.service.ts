import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto, UpdateProveedorDto, QueryProveedorDto } from './dto/proveedor.dto';

const firstNonEmpty = (...vals: any[]): any => {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

function normalizeProveedorInput(dto: CreateProveedorDto | UpdateProveedorDto) {
  const result: any = {};
  const nit = firstNonEmpty(dto.nit, dto.NIT);
  if (nit !== undefined) result.nit = String(nit).slice(0, 30);
  const razonSocial = firstNonEmpty(dto.razonSocial, dto.razon_social);
  if (razonSocial !== undefined) result.razonSocial = String(razonSocial).slice(0, 250);
  const asesorNombre = firstNonEmpty(dto.asesorNombre, dto.asesor, dto.nombre_asesor);
  if (asesorNombre !== undefined) result.asesorNombre = String(asesorNombre).slice(0, 200);
  const asesorTelefono = firstNonEmpty(dto.asesorTelefono, dto.telefono, dto.telefono_asesor, dto.asesor_telefono);
  if (asesorTelefono !== undefined) result.asesorTelefono = String(asesorTelefono).slice(0, 50);
  const asesorCorreo = firstNonEmpty(dto.asesorCorreo, dto.email, dto.correo);
  if (asesorCorreo !== undefined) result.asesorCorreo = String(asesorCorreo).slice(0, 200);
  const condicionPagoTipoRaw = firstNonEmpty(dto.condicionPagoTipo, dto.condicionesPago, dto.condicion_pago, dto.condiciones_pago);
  if (condicionPagoTipoRaw !== undefined) {
    const s = String(condicionPagoTipoRaw).trim().toUpperCase();
    result.condicionPagoTipo = s.includes('CRED') ? 'CREDITO' : 'CONTADO';
    if (result.condicionPagoTipo.length > 20) result.condicionPagoTipo = result.condicionPagoTipo.slice(0, 20);
  }
  const condicionPagoDias = firstNonEmpty(dto.condicionPagoDias, dto.diasCredito, dto.dias_credito);
  if (condicionPagoDias !== undefined && !isNaN(Number(condicionPagoDias))) result.condicionPagoDias = Math.max(0, Number(condicionPagoDias));
  const bancoNombre = firstNonEmpty(dto.bancoNombre, dto.banco, dto.nombre_banco);
  if (bancoNombre !== undefined) result.bancoNombre = String(bancoNombre).slice(0, 150);
  const bancoTipoCuenta = firstNonEmpty(dto.bancoTipoCuenta, dto.tipo_cuenta, dto.tipoCuenta);
  if (bancoTipoCuenta !== undefined) result.bancoTipoCuenta = String(bancoTipoCuenta).slice(0, 50);
  const bancoNumeroCuenta = firstNonEmpty(dto.bancoNumeroCuenta, dto.cuentaBancaria, dto.cuenta_bancaria, dto.numero_cuenta);
  if (bancoNumeroCuenta !== undefined) result.bancoNumeroCuenta = String(bancoNumeroCuenta).slice(0, 100);
  const bancoTitular = firstNonEmpty(dto.bancoTitular, dto.titular, dto.titular_cuenta);
  if (bancoTitular !== undefined) result.bancoTitular = String(bancoTitular).slice(0, 200);
  if (typeof dto.estado === 'boolean') result.estado = dto.estado;
  return result;
}

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
        { asesorNombre: { contains: query.search, mode: 'insensitive' } },
        { asesorTelefono: { contains: query.search, mode: 'insensitive' } },
        { bancoNombre: { contains: query.search, mode: 'insensitive' } },
        { bancoNumeroCuenta: { contains: query.search, mode: 'insensitive' } },
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
    const data = normalizeProveedorInput(dto);
    if (!data.condicionPagoTipo) data.condicionPagoTipo = 'CONTADO';
    if (typeof data.condicionPagoDias !== 'number') data.condicionPagoDias = 0;
    data.estado = data.estado ?? true;
    return this.prisma.proveedores.create({ data });
  }

  async update(id: number, dto: UpdateProveedorDto) {
    await this.findOne(id);
    const data = normalizeProveedorInput(dto);
    return this.prisma.proveedores.update({ where: { idProveedor: id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.proveedores.delete({ where: { idProveedor: id } });
  }
}
