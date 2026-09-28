import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaquinaDto, UpdateMaquinaDto, AsignarMaquinaDto,
  CreateMapaMPDto, UpdateMapaMPDto, CreateMapaNRQDto, UpdateMapaNRQDto, QueryMaquinaDto,
} from './dto/maquina.dto';
import { Prisma } from '@prisma/client';

function tipoCanonico(tipo?: string): string | undefined {
  if (!tipo) return tipo;
  const t = String(tipo).toUpperCase();
  if (t === 'SNACK' || t === 'BEBIDA' || t === 'CAFÉ') return t === 'CAFÉ' ? 'CAFE' : 'SNACKS';
  return t;
}

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
        skip, take, where, orderBy: { fechaCreacion: 'desc' },
        include: {
          cliente: true, operador: true,
          mapaMateriaPrima: { include: { producto: true }, orderBy: { espiralCodigo: 'asc' } },
          mapaCafeNrq: { include: { productoTerminado: true }, orderBy: { opcionBoton: 'asc' } },
        },
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
        mapaMateriaPrima: { include: { producto: true }, orderBy: { espiralCodigo: 'asc' } },
        mapaCafeNrq: { include: { productoTerminado: true }, orderBy: { opcionBoton: 'asc' } },
      },
    });
    if (!m) throw new NotFoundException('Máquina no encontrada');
    // Enriquecer cada item del mapa con el precio de venta por cliente y el costo
    // del producto, para que el frontend muestre el precio según el cliente asignado.
    const preciosCliente = m.idCliente
      ? await this.prisma.preciosCliente.findMany({ where: { idCliente: m.idCliente } })
      : [];
    const precioDe = (idProducto: number) => {
      const pc = preciosCliente.find((p) => p.idProducto === idProducto);
      return pc ? Number(pc.precioVenta) : undefined;
    };
    m.mapaMateriaPrima = (m.mapaMateriaPrima as any[]).map((e) => {
      const prod = (e.producto as any);
      return {
        ...e,
        costoTotal: Number(prod?.costoTotal ?? e.costoTotal ?? 0),
        precioVentaCliente: precioDe(e.idProducto),
      };
    }) as any;
    m.mapaCafeNrq = (m.mapaCafeNrq as any[]).map((b) => {
      const prod = (b.productoTerminado as any);
      return {
        ...b,
        costoTotal: Number(prod?.costoTotal ?? b.costoTotal ?? 0),
        precioVentaCliente: precioDe(b.idProdTerm),
      };
    }) as any;
    return m;
  }

  async create(dto: CreateMaquinaDto) {
    const data: any = { ...dto };
    if (dto.tipo) data.tipo = tipoCanonico(dto.tipo);
    if (dto.fechaInstalacion) data.fechaInstalacion = new Date(dto.fechaInstalacion);
    if (dto.tarifaPromedioOverride !== undefined) data.tarifaPromedioOverride = new Prisma.Decimal(dto.tarifaPromedioOverride);
    return this.prisma.maquinasYTiendas.create({ data });
  }

  async update(id: number, dto: UpdateMaquinaDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.tipo) data.tipo = tipoCanonico(dto.tipo);
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

  // ============================================================
  // Guardado masivo del Mapa (formato del frontend)
  // POST /maquinas/:id/espirales  body { espirales: [...] }
  // POST /maquinas/:id/botones    body { botones: [...] }
  // Reemplazan el mapa completo con upsert por clave única.
  // ============================================================
  async saveMapaEspirales(id: number, espirales: any[]) {
    const maq = await this.findOne(id);
    if (maq.tipo === 'CAFE') throw new BadRequestException('La máquina es de tipo CAFE, use botones NRQ.');
    if (!Array.isArray(espirales)) throw new BadRequestException('espirales debe ser un arreglo');
    const codigos = espirales.map((e) => String(e.espiral)).filter((c) => !!c);
    for (const e of espirales) {
      if (!e?.espiral || e?.espiral === '') continue;
      const idProducto = Number(e.productoId ?? e.idProducto);
      if (!idProducto) throw new BadRequestException('Cada espiral debe tener un producto asignado');
      await this.prisma.mapaMateriaPrima.upsert({
        where: { idMaquina_espiralCodigo: { idMaquina: id, espiralCodigo: String(e.espiral) } },
        update: {
          idProducto,
          capacidadMax: Number(e.capacidad_max ?? e.capacidadMax ?? 0),
        },
        create: {
          idMaquina: id,
          idProducto,
          espiralCodigo: String(e.espiral),
          capacidadMax: Number(e.capacidad_max ?? e.capacidadMax ?? 0),
        },
      });
    }
    // Eliminar espirales que ya no están en el mapa (quedarían huérfanos)
    await this.prisma.mapaMateriaPrima.deleteMany({
      where: { idMaquina: id, espiralCodigo: { notIn: codigos } },
    });
    return this.getMapaMP(id);
  }

  async saveMapaBotones(id: number, botones: any[]) {
    const maq = await this.findOne(id);
    if (maq.tipo !== 'CAFE') throw new BadRequestException('La máquina debe ser de tipo CAFE');
    if (!Array.isArray(botones)) throw new BadRequestException('botones debe ser un arreglo');
    const opciones = botones.map((b) => String(b.boton)).filter((c) => !!c);
    for (const b of botones) {
      if (!b?.boton || b?.boton === '') continue;
      const idProdTerm = Number(b.productoId ?? b.idProdTerm);
      if (!idProdTerm) throw new BadRequestException('Cada botón debe tener un producto asignado');
      await this.prisma.mapaCafeNrq.upsert({
        where: { idMaquina_opcionBoton: { idMaquina: id, opcionBoton: String(b.boton) } },
        update: { idProdTerm },
        create: { idMaquina: id, idProdTerm, opcionBoton: String(b.boton) },
      });
    }
    // Eliminar botones que ya no están en el mapa
    await this.prisma.mapaCafeNrq.deleteMany({
      where: { idMaquina: id, opcionBoton: { notIn: opciones } },
    });
    return this.getMapaNRQ(id);
  }
}
