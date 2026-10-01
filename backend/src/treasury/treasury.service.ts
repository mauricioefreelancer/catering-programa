import { Injectable, NotFoundException, MethodNotAllowedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEfectivoNrDto, CompletarEfectivoNrDto, CreateSaldoDigitalDto, UpdateSaldoDigitalDto, QueryFacturacionNrqDto } from './dto/treasury.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  async createEfectivoNr(dto: CreateEfectivoNrDto) {
    const maq = await this.prisma.maquinasYTiendas.findUnique({ where: { idMaquina: dto.idMaquina } });
    if (!maq) throw new NotFoundException('Máquina no encontrada');
    const op = await this.prisma.operadores.findUnique({ where: { idOperador: dto.idOperador } });
    if (!op) throw new NotFoundException('Operador no encontrado');

    // Evitar recaudo duplicado para la misma visita (idGrupo)
    if (dto.idGrupo != null) {
      const ya = await this.prisma.tesoreriaEfectivoNr.findFirst({ where: { idGrupo: dto.idGrupo } });
      if (ya) throw new BadRequestException(`La visita ${dto.idGrupo} ya tiene un recaudo (#${ya.idRecaudo})`);
    }

    // NR anterior: se toma el enviado por el frontend (último NR digitado por el operador
    // en la visita previa) o, en su defecto, el último recaudo cerrado de la máquina.
    let nrAnterior = dto.nrAnterior;
    if (nrAnterior === undefined || nrAnterior === null) {
      const ultimoCerrado = await this.prisma.tesoreriaEfectivoNr.findFirst({
        where: { idMaquina: dto.idMaquina, estado: 'CERRADO' },
        orderBy: { fechaHora: 'desc' },
      });
      nrAnterior = ultimoCerrado ? Number(ultimoCerrado.nrActual) : (maq.ultimoContadorNR ? Number(maq.ultimoContadorNR) : 0);
    }
    nrAnterior = Math.max(0, Number(nrAnterior));
    const nrActual = Math.max(0, Number(dto.nrActual));
    const diferenciaNr = Math.max(0, nrActual - nrAnterior);
    const tarifaDefault = Number(process.env.TARIFA_PROMEDIO_DEFAULT || 3500);
    const tarifa = maq.tarifaPromedioOverride !== null && maq.tarifaPromedioOverride !== undefined
      ? Number(maq.tarifaPromedioOverride)
      : tarifaDefault;
    const totalVendido = diferenciaNr * tarifa; // NR = ventas totales de la máquina (efectivo + tarjetas)
    const veos = Math.max(0, Number(dto.veosRecog ?? 0));
    const datafono = Math.max(0, Number(dto.datafonoRecog ?? 0));
    const cupos = Math.max(0, Number(dto.cuposRecog ?? 0));
    const mediosNoEfectivo = veos + datafono + cupos;
    const efectivoEsperado = Math.max(0, totalVendido - mediosNoEfectivo);
    // Si se digitó el efectivo que trae el operador, el recaudo queda cerrado;
    // de lo contrario queda PENDIENTE hasta completarse.
    const tieneEfectivo = dto.efectivoRecog !== undefined && dto.efectivoRecog !== null;
    const efectivoRecog = tieneEfectivo ? Math.max(0, Number(dto.efectivoRecog)) : 0;
    const estado = tieneEfectivo ? 'CERRADO' : 'PENDIENTE';
    const diferenciaRec = efectivoRecog - efectivoEsperado;

    // Actualizar el último contador NR de la máquina con el nrActual
    await this.prisma.maquinasYTiendas.update({
      where: { idMaquina: dto.idMaquina },
      data: { ultimoContadorNR: BigInt(nrActual) },
    });

    return this.prisma.tesoreriaEfectivoNr.create({
      data: {
        idGrupo: dto.idGrupo ?? null,
        idMaquina: dto.idMaquina,
        idOperador: dto.idOperador,
        idUsuario: dto.idUsuario,
        fechaHora: dto.fechaHora ? new Date(dto.fechaHora) : new Date(),
        nrAnterior: BigInt(nrAnterior),
        nrActual: BigInt(nrActual),
        diferenciaNr: BigInt(diferenciaNr),
        tarifaAplicada: new Prisma.Decimal(tarifa),
        efectivoTeorico: new Prisma.Decimal(totalVendido),
        totalVendido: new Prisma.Decimal(totalVendido),
        veosRecog: new Prisma.Decimal(veos),
        datafonoRecog: new Prisma.Decimal(datafono),
        cuposRecog: new Prisma.Decimal(cupos),
        mediosNoEfectivo: new Prisma.Decimal(mediosNoEfectivo),
        efectivoEsperado: new Prisma.Decimal(efectivoEsperado),
        efectivoRecog: new Prisma.Decimal(efectivoRecog),
        diferenciaRec: new Prisma.Decimal(diferenciaRec),
        estado,
      },
    });
  }

  // Lista las visitas/pedidos (grupos) del operador con su NR, para cerrar el recaudo por visita
  async listarVisitasRecaudo(query: any) {
    const idOperador = query?.idOperador ? Number(query.idOperador) : undefined;
    const idMaquina = query?.idMaquina ? Number(query.idMaquina) : undefined;
    const soloPendientes = query?.soloPendientes === 'true' || query?.soloPendientes === true;

    // 1) Todos los pedidos con NR, ordenados por fecha
    const pedidos = await this.prisma.pedidosOperador.findMany({
      where: {
        nrActualMedido: { not: null },
        ...(idOperador ? { idOperador } : {}),
        ...(idMaquina ? { idMaquina } : {}),
      },
      select: { idGrupo: true, idMaquina: true, idOperador: true, fechaHora: true, nrActualMedido: true },
      orderBy: { fechaHora: 'asc' },
    });

    // 2) Agrupar por idGrupo (visita)
    type Visita = { idGrupo: number; idMaquina: number; idOperador: number; fechaVisita: Date; nrActual: number; nrAnterior: number };
    const mapa = new Map<number, Visita>();
    for (const p of pedidos) {
      if (p.idGrupo == null) continue;
      const act = mapa.get(p.idGrupo);
      const nr = Number(p.nrActualMedido) || 0;
      if (!act) {
        mapa.set(p.idGrupo, { idGrupo: p.idGrupo, idMaquina: p.idMaquina, idOperador: p.idOperador, fechaVisita: p.fechaHora, nrActual: nr, nrAnterior: 0 });
      } else {
        if (p.fechaHora < act.fechaVisita) act.fechaVisita = p.fechaHora;
        if (nr > act.nrActual) act.nrActual = nr;
      }
    }

    // 3) NR anterior por máquina: máximo NR de pedidos anteriores a la fecha de la visita
    const visitas = [...mapa.values()].sort((a, b) => a.fechaVisita.getTime() - b.fechaVisita.getTime());
    const nrAnteriorPorMaquina = new Map<number, number>();
    for (const v of visitas) {
      v.nrAnterior = nrAnteriorPorMaquina.get(v.idMaquina) ?? 0;
      nrAnteriorPorMaquina.set(v.idMaquina, v.nrActual);
    }

    // 4) Recaudos ya existentes por visita (CERRADO o PENDIENTE)
    const gruposRecaudados = await this.prisma.tesoreriaEfectivoNr.findMany({
      where: { idGrupo: { in: visitas.map((v) => v.idGrupo) } },
      select: { idGrupo: true, idRecaudo: true, estado: true, efectivoEsperado: true, veosRecog: true, datafonoRecog: true, cuposRecog: true },
    });
    const recAudados = new Map(gruposRecaudados.map((r) => [r.idGrupo, r]));

    // 5) Adjuntar máquina y operador
    const idsMaq = [...new Set(visitas.map((v) => v.idMaquina))];
    const idsOp = [...new Set(visitas.map((v) => v.idOperador))];
    const [maqs, ops] = await Promise.all([
      this.prisma.maquinasYTiendas.findMany({ where: { idMaquina: { in: idsMaq } }, select: { idMaquina: true, serial: true, ubicacionEsp: true, mediosPago: true, tarifaPromedioOverride: true } }),
      this.prisma.operadores.findMany({ where: { idOperador: { in: idsOp } }, select: { idOperador: true, nombreCompleto: true, zonaAsignada: true } }),
    ]);
    const maqMap = new Map(maqs.map((m) => [m.idMaquina, m]));
    const opMap = new Map(ops.map((o) => [o.idOperador, o]));

    // La tarifa con la que se estima el efectivo esperado por visita (NR = ventas totales)
    const tarifaDefault = Number(process.env.TARIFA_PROMEDIO_DEFAULT || 3500);

    const lista = visitas
      .map((v) => {
        const recaudo = recAudados.get(v.idGrupo);
        const diferenciaNR = Math.max(0, v.nrActual - v.nrAnterior);
        const tarifa = Number(maqMap.get(v.idMaquina)?.tarifaPromedioOverride ?? tarifaDefault);
        const est = { ...recaudo, mediosPago: maqMap.get(v.idMaquina)?.mediosPago ?? null };
        return {
          idGrupo: v.idGrupo,
          idMaquina: v.idMaquina,
          idOperador: v.idOperador,
          fechaVisita: v.fechaVisita,
          nrAnterior: v.nrAnterior,
          nrActual: v.nrActual,
          diferenciaNR,
          totalVendido: diferenciaNR * tarifa,
          maquina: maqMap.get(v.idMaquina) ?? null,
          operador: opMap.get(v.idOperador) ?? null,
          estado: est?.estado ?? 'PENDIENTE',
          idRecaudo: est?.idRecaudo ?? null,
          recaudoGuardado: est?.idRecaudo
            ? {
                idRecaudo: est.idRecaudo,
                estado: est.estado,
                efectivoEsperado: Number(est.efectivoEsperado || 0),
                veosRecog: Number(est.veosRecog || 0),
                datafonoRecog: Number(est.datafonoRecog || 0),
                cuposRecog: Number(est.cuposRecog || 0),
              }
            : null,
        };
      })
      .filter((v) => !soloPendientes || v.estado === 'PENDIENTE')
      .sort((a, b) => b.fechaVisita.getTime() - a.fechaVisita.getTime());

    return { total: lista.length, visitas: lista };
  }

  async checkClosedForMutation(id: number, metodo: string) {
    const r = await this.prisma.tesoreriaEfectivoNr.findUnique({ where: { idRecaudo: id } });
    if (!r) throw new NotFoundException('Registro no encontrado');
    if (r.estado === 'CERRADO') {
      throw new MethodNotAllowedException('No se permite modificar registros CERRADOS');
    }
  }

  async updateEfectivoNr(id: number, dto: CompletarEfectivoNrDto) {
    const r = await this.prisma.tesoreriaEfectivoNr.findUnique({ where: { idRecaudo: id } });
    if (!r) throw new NotFoundException('Registro no encontrado');
    if (r.estado === 'CERRADO') {
      throw new MethodNotAllowedException('No se permite modificar registros CERRADOS');
    }
    // Solo se permite completar (cerrar) un recaudo pendiente digitando el efectivo.
    if (dto.efectivoRecog === undefined || dto.efectivoRecog === null) {
      throw new BadRequestException('Debe digitar el efectivo recogido para cerrar el recaudo');
    }
    const efectivoRecog = Math.max(0, Number(dto.efectivoRecog));
    const efectivoEsperado = Number(r.efectivoEsperado || 0);
    const diferenciaRec = efectivoRecog - efectivoEsperado;
    return this.prisma.tesoreriaEfectivoNr.update({
      where: { idRecaudo: id },
      data: {
        efectivoRecog: new Prisma.Decimal(efectivoRecog),
        diferenciaRec: new Prisma.Decimal(diferenciaRec),
        estado: 'CERRADO',
      },
    });
  }

  async removeEfectivoNr(_id: number) {
    throw new MethodNotAllowedException('DELETE no permitido para registros de tesorería cerrados');
  }

  async findAllSaldos() {
    return this.prisma.saldosDigitales.findMany({
      include: { maquina: true, usuario: true },
      orderBy: { fechaTransaccion: 'desc' },
    });
  }

  async createSaldo(dto: CreateSaldoDigitalDto) {
    return this.prisma.saldosDigitales.create({
      data: {
        idMaquina: dto.idMaquina,
        plataforma: dto.plataforma,
        montoTransaccion: new Prisma.Decimal(dto.montoTransaccion),
        fechaTransaccion: dto.fechaTransaccion ? new Date(dto.fechaTransaccion) : new Date(),
        referencia: dto.referencia ?? null,
        idUsuario: dto.idUsuario,
      },
    });
  }

  async updateSaldo(id: number, dto: UpdateSaldoDigitalDto) {
    const s = await this.prisma.saldosDigitales.findUnique({ where: { idSaldo: id } });
    if (!s) throw new NotFoundException('Saldo no encontrado');
    const data: any = { ...dto };
    if (dto.montoTransaccion !== undefined) data.montoTransaccion = new Prisma.Decimal(dto.montoTransaccion);
    return this.prisma.saldosDigitales.update({ where: { idSaldo: id }, data });
  }

  async removeSaldo(id: number) {
    const s = await this.prisma.saldosDigitales.findUnique({ where: { idSaldo: id } });
    if (!s) throw new NotFoundException('Saldo no encontrado');
    return this.prisma.saldosDigitales.delete({ where: { idSaldo: id } });
  }

  async facturacionNrq(query: QueryFacturacionNrqDto) {
    const fechaInicio = new Date(query.fechaInicio);
    const fechaFin = new Date(query.fechaFin);
    const where: any = {
      fechaHora: { gte: fechaInicio, lte: fechaFin },
    };
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        m."ID_Maquina",
        m."Serial",
        c."ID_Cliente",
        c."Razon_Social",
        p."ID_Producto",
        p."Nombre_Producto",
        COALESCE(MAX(CASE WHEN tg = 'inicial' THEN nrq END), 0) as "NRQ_Inicial",
        COALESCE(MAX(CASE WHEN tg = 'final' THEN nrq END), 0) as "NRQ_Final",
        COALESCE(MAX(CASE WHEN tg = 'final' THEN nrq END), 0) - COALESCE(MAX(CASE WHEN tg = 'inicial' THEN nrq END), 0) as "NRQ_Diferencia",
        COALESCE(AVG(pc."Precio_Venta"), 0) as "Precio_Promedio"
      FROM (
        SELECT
          po."ID_Maquina",
          po."ID_Producto",
          po."ID_Operador",
          MIN(po."NRQ_Actual_Lectura") as nrq,
          'inicial'::text as tg,
          MIN(po."Fecha_Hora") as fh
        FROM public."PEDIDOS_OPERADOR" po
        WHERE po."NRQ_Actual_Lectura" IS NOT NULL
          AND po."Fecha_Hora" >= ${fechaInicio}
          AND po."Fecha_Hora" <= ${fechaFin}
        GROUP BY po."ID_Maquina", po."ID_Producto", po."ID_Operador", DATE(po."Fecha_Hora")
        UNION ALL
        SELECT
          po."ID_Maquina",
          po."ID_Producto",
          po."ID_Operador",
          MAX(po."NRQ_Actual_Lectura") as nrq,
          'final'::text as tg,
          MAX(po."Fecha_Hora") as fh
        FROM public."PEDIDOS_OPERADOR" po
        WHERE po."NRQ_Actual_Lectura" IS NOT NULL
          AND po."Fecha_Hora" >= ${fechaInicio}
          AND po."Fecha_Hora" <= ${fechaFin}
        GROUP BY po."ID_Maquina", po."ID_Producto", po."ID_Operador", DATE(po."Fecha_Hora")
      ) x
      JOIN public."MAQUINAS_Y_TIENDAS" m ON x."ID_Maquina" = m."ID_Maquina"
      LEFT JOIN public."CLIENTES" c ON m."ID_Cliente" = c."ID_Cliente"
      JOIN public."PRODUCTOS" p ON x."ID_Producto" = p."ID_Producto"
      LEFT JOIN public."PRECIOS_CLIENTE" pc ON p."ID_Producto" = pc."ID_Producto" AND c."ID_Cliente" = pc."ID_Cliente"
      WHERE (${query.idCliente === undefined} OR c."ID_Cliente" = ${query.idCliente ? parseInt(query.idCliente) : null})
        AND (${query.idProducto === undefined} OR p."ID_Producto" = ${query.idProducto ? parseInt(query.idProducto) : null})
      GROUP BY m."ID_Maquina", m."Serial", c."ID_Cliente", c."Razon_Social", p."ID_Producto", p."Nombre_Producto"
      ORDER BY c."Razon_Social", m."Serial", p."Nombre_Producto"
    `;
    return {
      registros: result,
      totalDiferenciaNrq: result.reduce((acc, r) => acc + Number(r['NRQ_Diferencia'] || 0), 0),
      totalFacturarEstimado: result.reduce((acc, r) => acc + (Number(r['NRQ_Diferencia'] || 0) * Number(r['Precio_Promedio'] || 0)), 0),
    };
  }
}
