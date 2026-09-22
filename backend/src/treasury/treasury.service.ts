import { Injectable, NotFoundException, MethodNotAllowedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEfectivoNrDto, CreateSaldoDigitalDto, UpdateSaldoDigitalDto, QueryFacturacionNrqDto } from './dto/treasury.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  async createEfectivoNr(dto: CreateEfectivoNrDto) {
    const maq = await this.prisma.maquinasYTiendas.findUnique({ where: { idMaquina: dto.idMaquina } });
    if (!maq) throw new NotFoundException('Máquina no encontrada');
    const op = await this.prisma.operadores.findUnique({ where: { idOperador: dto.idOperador } });
    if (!op) throw new NotFoundException('Operador no encontrado');

    const ultimoCerrado = await this.prisma.tesoreriaEfectivoNr.findFirst({
      where: { idMaquina: dto.idMaquina, estado: 'CERRADO' },
      orderBy: { fechaHora: 'desc' },
    });
    const nrAnterior = ultimoCerrado ? Number(ultimoCerrado.nrActual) : 0;
    const diferenciaNr = Math.max(0, dto.nrActual - nrAnterior);
    const tarifaDefault = Number(process.env.TARIFA_PROMEDIO_DEFAULT || 3500);
    const tarifa = maq.tarifaPromedioOverride !== null && maq.tarifaPromedioOverride !== undefined
      ? Number(maq.tarifaPromedioOverride)
      : tarifaDefault;
    const efectivoTeorico = diferenciaNr * tarifa;
    const diferenciaRec = dto.efectivoRecog - efectivoTeorico;

    return this.prisma.tesoreriaEfectivoNr.create({
      data: {
        idMaquina: dto.idMaquina,
        idOperador: dto.idOperador,
        idUsuario: dto.idUsuario,
        fechaHora: dto.fechaHora ? new Date(dto.fechaHora) : new Date(),
        nrAnterior: BigInt(nrAnterior),
        nrActual: BigInt(dto.nrActual),
        diferenciaNr: BigInt(diferenciaNr),
        tarifaAplicada: new Prisma.Decimal(tarifa),
        efectivoTeorico: new Prisma.Decimal(efectivoTeorico),
        efectivoRecog: new Prisma.Decimal(dto.efectivoRecog),
        diferenciaRec: new Prisma.Decimal(diferenciaRec),
        estado: 'CERRADO',
      },
    });
  }

  async checkClosedForMutation(id: number, metodo: string) {
    const r = await this.prisma.tesoreriaEfectivoNr.findUnique({ where: { idRecaudo: id } });
    if (!r) throw new NotFoundException('Registro no encontrado');
    if (r.estado === 'CERRADO') {
      throw new MethodNotAllowedException('No se permite modificar registros CERRADOS');
    }
  }

  async updateEfectivoNr(_id: number, _dto: any) {
    throw new MethodNotAllowedException('PATCH no permitido para registros de tesorería cerrados');
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
