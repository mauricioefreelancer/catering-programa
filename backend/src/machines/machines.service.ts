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

  async create(dto: CreateMaquinaDto, userId?: number | null) {
    const data: any = { ...dto };
    if (dto.tipo) data.tipo = tipoCanonico(dto.tipo);
    if (dto.fechaInstalacion) data.fechaInstalacion = new Date(dto.fechaInstalacion);
    if (dto.tarifaPromedioOverride !== undefined) data.tarifaPromedioOverride = new Prisma.Decimal(dto.tarifaPromedioOverride);
    if (dto.base !== undefined) data.base = new Prisma.Decimal(dto.base);
    const creada = await this.prisma.maquinasYTiendas.create({ data });
    // Registrar medios de pago iniciales en el historial (trazabilidad por fecha)
    if (dto.mediosPago && typeof dto.mediosPago === 'object') {
      await this.registrarHistorialMediosPago(creada.idMaquina, creada.serial, null, dto.mediosPago, userId, 'CREAR');
    }
    return creada;
  }

  async update(id: number, dto: UpdateMaquinaDto, userId?: number | null) {
    const previa = await this.findOne(id);
    // El valor anterior de medios de pago ANTES de aplicar el cambio
    const antesMP = previa.mediosPago ?? null;
    const data: any = { ...dto };
    if (dto.tipo) data.tipo = tipoCanonico(dto.tipo);
    if (dto.fechaInstalacion) data.fechaInstalacion = new Date(dto.fechaInstalacion);
    if (dto.tarifaPromedioOverride !== undefined) data.tarifaPromedioOverride = new Prisma.Decimal(dto.tarifaPromedioOverride);
    if (dto.base !== undefined) data.base = new Prisma.Decimal(dto.base);
    const actualizada = await this.prisma.maquinasYTiendas.update({ where: { idMaquina: id }, data });
    // Registrar los cambios de medios de pago cuando el frontend los envía
    if (dto.mediosPago && typeof dto.mediosPago === 'object') {
      await this.registrarHistorialMediosPago(id, actualizada.serial, antesMP, dto.mediosPago, userId, 'CAMBIAR');
    }
    return actualizada;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.maquinasYTiendas.delete({ where: { idMaquina: id } });
  }

  async asignar(id: number, dto: AsignarMaquinaDto, userId?: number | null) {
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
  // Rendimiento de dosificados (máquina café)
  // Calcula, a partir de las Materias Primas en las espirales y de
  // las recetas de cada botón (dosificado), cuántas tazas/servicios
  // se pueden servir y cuánto consume cada MP.
  // ============================================================
  async rendimiento(id: number) {
    const m = await this.findOne(id);
    if (m.tipo !== 'CAFE') throw new BadRequestException('Solo las máquinas de tipo CAFE tienen rendimiento de dosificados');

    // Precio de venta del dosificado según el cliente asignado a la máquina
    const preciosCliente = m.idCliente
      ? await this.prisma.preciosCliente.findMany({ where: { idCliente: m.idCliente } })
      : [];
    const precioDe = (idProducto: number) => {
      const pc = preciosCliente.find((p) => p.idProducto === idProducto);
      return pc ? Number(pc.precioVenta) : undefined;
    };

    // Materias Primas en las espirales de la máquina
    const espirales: any[] = await this.prisma.mapaMateriaPrima.findMany({
      where: { idMaquina: id },
      include: { producto: { include: { proveedor: true } } },
      orderBy: { espiralCodigo: 'asc' },
    });

    // Botones / productos dosificados con su receta
    const botones: any[] = await this.prisma.mapaCafeNrq.findMany({
      where: { idMaquina: id },
      include: {
        productoTerminado: {
          include: { recetasProdTerm: { include: { materiaPrima: true } } },
        },
      },
      orderBy: { opcionBoton: 'asc' },
    });

    // MPI: unidades disponibles por Materia Prima (empaques * equivalencia),
    // costo por unidad de consumo y proveedor, para calcular el costo por taza.
    const mpIndex = new Map<number, any>();
    for (const e of espirales) {
      const prod: any = e.producto as any;
      if (!prod) continue;
      const idP = e.idProducto;
      const equiv = Number(prod.equivalencia ?? 1) || 1;
      const unidades = (e.capacidadActual ?? 0) * equiv;
      // Costo por unidad consumida = costoTotal del empaque / equivalencia
      const costoTotal = Number(prod.costoTotal ?? prod.costo_total ?? 0);
      const costoPorUnidad = equiv > 0 ? costoTotal / equiv : 0;
      const prev = mpIndex.get(idP);
      if (prev) {
        prev.empaques += e.capacidadActual ?? 0;
        prev.unidadesDisponibles += unidades;
      } else {
        mpIndex.set(idP, {
          idProducto: idP,
          nombre: prod.nombreProducto ?? '',
          unidad: prod.unidadConsumo ?? prod.unidad_consumo ?? 'und',
          equivalencia: equiv,
          empaques: e.capacidadActual ?? 0,
          espiral: e.espiralCodigo,
          unidadesDisponibles: unidades,
          costoTotal: costoTotal,
          costoPorUnidad: costoPorUnidad,
          proveedor: prod.proveedor?.razonSocial ?? prod.proveedor?.razon_social ?? '',
          tipoCafe: prod.tipoCafe ?? prod.tipo_cafe ?? null,
        });
      }
    }

    // Dosificados → cuántas tazas por cada MP, factor limitante y costo por taza
    const dosificados = (botones as any[]).map((b) => {
      const dt: any = b.productoTerminado as any;
      const recetas: any[] = Array.isArray(dt?.recetasProdTerm) ? dt.recetasProdTerm : [];
      const ingredientes = recetas.map((r: any) => {
        const mpInfo = mpIndex.get(r.idMatPrima);
        const dosis = Number(r.cantidadDosis ?? 0);
        const unidades = mpInfo?.unidadesDisponibles ?? 0;
        const tazasMP = dosis > 0 ? Math.floor(unidades / dosis) : 0;
        const costoIng = (mpInfo?.costoPorUnidad ?? 0) * dosis;
        const tipoCafe = mpInfo?.tipoCafe ?? r.materiaPrima?.tipoCafe ?? null;
        const dosisSugerida = tipoCafe === 'SOLUBLE' ? 2 : tipoCafe === 'GRANO' ? 8 : null;
        return {
          idMatPrima: r.idMatPrima,
          nombre: mpInfo?.nombre ?? r.materiaPrima?.nombreProducto ?? '',
          unidad: mpInfo?.unidad ?? r.unidadDosis ?? 'und',
          empaques: mpInfo?.empaques ?? 0,
          equivalencia: mpInfo?.equivalencia ?? 1,
          unidadesDisponibles: unidades,
          dosis,
          tipoCafe,
          dosisSugerida,
          tazasPosibles: Math.max(0, tazasMP),
          costoPorTaza: Math.round(costoIng * 100) / 100,
        };
      });
      const tazasTotal = ingredientes.length
        ? Math.min(...ingredientes.map((i: any) => i.tazasPosibles))
        : 0;
      const limitante = ingredientes.find((i: any) => i.tazasPosibles === tazasTotal)?.nombre;
      const costoPorTaza = Math.round(ingredientes.reduce((acc: number, i: any) => acc + (i.costoPorTaza ?? 0), 0) * 100) / 100;
      const precioVenta = precioDe(b.idProdTerm);
      return {
        idMapaNrq: b.idMapaNrq,
        boton: b.opcionBoton,
        idProducto: b.idProdTerm,
        nombre: dt?.nombreProducto ?? '',
        ingredientes,
        tazasPosibles: Math.max(0, tazasTotal),
        limitante,
        costoPorTaza,
        precioVenta,
        margen: precioVenta != null && precioVenta > 0
          ? Math.round(((precioVenta - costoPorTaza) / precioVenta) * 10000) / 100
          : undefined,
      };
    });

    // Resumen por MP: cuánto consume por servicio la suma de todos los botones
    const materiasPrimas = Array.from(mpIndex.values()).map((mp) => {
      let dosisTotal = 0;
      for (const d of dosificados) {
        const ing = d.ingredientes.find((i: any) => i.idMatPrima === mp.idProducto);
        if (ing) dosisTotal += ing.dosis;
      }
      return {
        ...mp,
        dosisPorServicioTotal: dosisTotal,
        serviciosPosibles: dosisTotal > 0 ? Math.max(0, Math.floor(mp.unidadesDisponibles / dosisTotal)) : 0,
      };
    });

    return {
      maquina: { id, serial: m.serial },
      materiasPrimas,
      dosificados,
    };
  }

  // ============================================================
  // Guardado masivo del Mapa (formato del frontend)
  // POST /maquinas/:id/espirales  body { espirales: [...] }
  // POST /maquinas/:id/botones    body { botones: [...] }
  // Reemplazan el mapa completo con upsert por clave única.
  // ============================================================
  async saveMapaEspirales(id: number, espirales: any[]) {
    await this.findOne(id); // valida que la máquina exista
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
          capacidadActual: Number(e.cantidad_actual ?? e.capacidadActual ?? 0),
        },
        create: {
          idMaquina: id,
          idProducto,
          espiralCodigo: String(e.espiral),
          capacidadMax: Number(e.capacidad_max ?? e.capacidadMax ?? 0),
          capacidadActual: Number(e.cantidad_actual ?? e.capacidadActual ?? 0),
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
      const prodTerm = await this.prisma.productos.findFirst({
        where: { idProducto: idProdTerm },
        select: { idProducto: true, tipoProducto: true },
      });
      if (!prodTerm) throw new BadRequestException(`El producto del botón ${b?.boton} no existe`);
      const tipoProd = String(prodTerm.tipoProducto ?? '').toUpperCase();
      if (!tipoProd.includes('DOSIF')) {
        throw new BadRequestException(`El botón ${b?.boton} debe ser un producto DOSIFICADO (receta café). '${prodTerm.tipoProducto}' no es válido.`);
      }
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

  // ============================================================
  // HISTORIAL DE MEDIOS DE PAGO
  // Registra en HISTORIAL_MEDIOS_PAGO cada cambio de activación o de
  // serial de un dispositivo de cobro de la máquina, con fecha y usuario,
  // para poder trazar POR FECHA cuándo se agregó/cambió/quitó un dispositivo.
  // ============================================================
  private async registrarHistorialMediosPago(
    idMaquina: number,
    serialMaquina: string,
    antes: any,
    nuevo: any,
    userId?: number | null,
    accionBase: 'CREAR' | 'CAMBIAR' = 'CAMBIAR',
  ) {
    const a = antes ?? {};
    const n = nuevo ?? {};

    // Medios observables: [clave estado, {seriales}] -> nombre del medio
    const medios: Array<{ key: string; serialKeys: string[]; nombre: string }> = [
      { key: 'veos', serialKeys: ['serialVeos'], nombre: 'VEOS' },
      { key: 'datafono', serialKeys: ['serialDatafono'], nombre: 'DATAFONO' },
      { key: 'cupos', serialKeys: ['serialCupos'], nombre: 'CUPOS' },
      { key: 'efectivo', serialKeys: ['serialEfectivoMonedero', 'serialEfectivoBilletero'], nombre: 'EFECTIVO' },
    ];

    const registros: any[] = [];

    for (const medio of medios) {
      const activoAntes = !!a[medio.key];
      const activoAhora = !!n[medio.key];

      // 1) Cambio de activación (encendido/apagado del dispositivo)
      if (activoAntes !== activoAhora) {
        registros.push({
          idMaquina,
          serialMaquina,
          tipoMedio: medio.nombre,
          serialDispositivo: null,
          accion: activoAhora ? 'ACTIVAR' : 'INACTIVAR',
          valorAnterior: { [medio.key]: activoAntes, ...this.serialesDe(a, medio.serialKeys) },
          valorNuevo: { [medio.key]: activoAhora, ...this.serialesDe(n, medio.serialKeys) },
        });
      }

      // 2) Cambios de serial de cada dispositivo de ese medio, cuando el medio
      //    está activo (o antes lo estaba). Detecta asignar/cambiar/quitar serial.
      if (activoAntes || activoAhora) {
        for (const sKey of medio.serialKeys) {
          const serialAntes = this.norm(a[sKey]);
          const serialAhora = this.norm(n[sKey]);
          if (serialAntes === serialAhora) continue;
          let accion: string;
          if (!serialAntes && serialAhora) accion = 'ASIGNAR_SERIAL';
          else if (serialAntes && !serialAhora) accion = 'QUITAR_SERIAL';
          else accion = 'CAMBIAR_SERIAL';
          registros.push({
            idMaquina,
            serialMaquina,
            tipoMedio: medio.nombre,
            serialDispositivo: serialAhora || serialAntes || null,
            accion,
            valorAnterior: { [sKey]: serialAntes ?? null },
            valorNuevo: { [sKey]: serialAhora ?? null },
          });
        }
      }
    }

    // Cuando es creación inicial y no hubo cambios de activación/serial (veamos
    // solo composiciones de estados sin seriales), igual se registra la foto inicial
    if (registros.length === 0 && accionBase === 'CREAR') {
      registros.push({
        idMaquina,
        serialMaquina,
        tipoMedio: 'COMPOSICION',
        serialDispositivo: null,
        accion: 'CREAR',
        valorAnterior: null,
        valorNuevo: n,
      });
    }

    for (const r of registros) {
      await this.prisma.historialMediosPago.create({
        data: {
          idMaquina: r.idMaquina,
          serialMaquina: r.serialMaquina,
          tipoMedio: r.tipoMedio,
          serialDispositivo: r.serialDispositivo,
          accion: r.accion,
          valorAnterior: r.valorAnterior,
          valorNuevo: r.valorNuevo,
          idUsuario: userId ?? null,
        },
      });
    }
  }

  private norm(v: any): string {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

  private serialesDe(obj: any, keys: string[]): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const k of keys) out[k] = this.norm(obj[k]) || null;
    return out;
  }

  // ============================================================
  // CONSULTA DE HISTORIAL DE MEDIOS DE PAGO
  // Permite filtrar por máquina, serial de dispositivo y rango de fechas.
  // GET /maquinas/historial-medios-pago?maquinaId=&serial=&fechaDesde=&fechaHasta=
  // ============================================================
  async historialMediosPago(query: { maquinaId?: string; serial?: string; fechaDesde?: string; fechaHasta?: string }) {
    const where: any = {};
    if (query.maquinaId) {
      const mid = parseInt(query.maquinaId);
      if (isNaN(mid)) throw new BadRequestException('maquinaId inválido');
      where.idMaquina = mid;
    }
    if (query.serial) {
      where.OR = [
        { serialDispositivo: { contains: query.serial, mode: 'insensitive' } },
        { serialMaquina: { contains: query.serial, mode: 'insensitive' } },
      ];
    }
    if (query.fechaDesde) {
      const d = new Date(query.fechaDesde);
      if (!isNaN(d.getTime())) where.fechaCambio = { ...(where.fechaCambio ?? {}), gte: d };
    }
    if (query.fechaHasta) {
      const d = new Date(query.fechaHasta);
      if (!isNaN(d.getTime())) where.fechaCambio = { ...(where.fechaCambio ?? {}), lte: d };
    }
    const data = await this.prisma.historialMediosPago.findMany({
      where,
      include: { usuario: { select: { idUsuario: true, nombreCompleto: true, usuarioLogin: true } } },
      orderBy: { fechaCambio: 'desc' },
    });
    return data;
  }
}
