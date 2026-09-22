import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoOperadorDto } from './dto/operador-pedido.dto';

@Injectable()
export class OperadorPedidoService {
  constructor(private prisma: PrismaService) {}

  async findAll(params?: { idOperador?: number; idMaquina?: number; estado?: string }) {
    const where: any = {};
    if (params?.idOperador) where.idOperador = Number(params.idOperador);
    if (params?.idMaquina) where.idMaquina = Number(params.idMaquina);
    if (params?.estado) where.estado = params.estado;
    return this.prisma.pedidosOperador.findMany({
      where,
      include: {
        maquina: { include: { cliente: true } },
        operador: true,
        producto: true,
        mapaMp: true,
        despachosBodega: { orderBy: { fechaHora: 'desc' } },
      },
      orderBy: { fechaHora: 'desc' },
      take: 500,
    });
  }

  async create(dto: CreatePedidoOperadorDto) {
    const maquina = await this.prisma.maquinasYTiendas.findUnique({
      where: { idMaquina: dto.idMaquina },
      include: {
        mapaMateriaPrima: { include: { producto: true } },
        mapaCafeNrq: { include: { productoTerminado: true } },
      },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    const operador = await this.prisma.operadores.findUnique({ where: { idOperador: dto.idOperador } });
    if (!operador) throw new NotFoundException('Operador no encontrado');

    const mapaMpById = new Map(maquina.mapaMateriaPrima.map((m) => [m.idMapaMp, m]));
    const mapaNrqById = new Map(maquina.mapaCafeNrq.map((m) => [m.idMapaNrq, m]));
    const pedidosCreados: any[] = [];

    for (const item of dto.items) {
      let capacidad = 0;
      let idMapaMpFinal: number | null = item.idMapaMP ?? null;
      let mpMatch: any = null;
      if (item.idMapaMP) {
        mpMatch = mapaMpById.get(item.idMapaMP);
        if (!mpMatch || mpMatch.idMaquina !== dto.idMaquina) {
          throw new BadRequestException(`Mapa MP ${item.idMapaMP} no pertenece a la máquina`);
        }
        if (mpMatch.idProducto !== item.idProducto) {
          throw new BadRequestException(`Mapa MP ${item.idMapaMP} no corresponde al producto ${item.idProducto}`);
        }
        capacidad = mpMatch.capacidadMax;
      } else {
        mpMatch = maquina.mapaMateriaPrima.find((m) => m.idProducto === item.idProducto);
        if (mpMatch) {
          capacidad = mpMatch.capacidadMax;
          idMapaMpFinal = mpMatch.idMapaMp;
        } else {
          capacidad = 500;
        }
      }
      if (capacidad < item.fisicoDigitado) {
        throw new BadRequestException(`Físico digitado ${item.fisicoDigitado} excede capacidad ${capacidad}`);
      }
      const cantSugerida = Math.max(0, capacidad - item.fisicoDigitado);
      const pedido = await this.prisma.pedidosOperador.create({
        data: {
          idMaquina: dto.idMaquina,
          idOperador: dto.idOperador,
          idProducto: item.idProducto,
          idMapaMp: idMapaMpFinal,
          fisicoDigitado: item.fisicoDigitado,
          cantSugerida,
          nrActualMedido: dto.nrActual ? BigInt(dto.nrActual) : null,
          estado: 'PENDIENTE',
        },
      });
      pedidosCreados.push(pedido);
    }

    const mpConsolidado = new Map<number, { mp: any; consumoUnidadConsumo: number; idMapaMp?: number; vendidasTotal: number }>();
    let totalNrqVendidas = 0;

    for (const nrqItem of dto.nrqItems ?? []) {
      const nrq = mapaNrqById.get(nrqItem.idMapaNRQ);
      if (!nrq || nrq.idMaquina !== dto.idMaquina) {
        throw new BadRequestException(`Mapa NRQ ${nrqItem.idMapaNRQ} no pertenece a la máquina`);
      }
      const idProdTerm = nrq.idProdTerm;
      const recetas = await this.prisma.recetasDosificados.findMany({
        where: { idProdTerm },
        include: { materiaPrima: true },
      });
      const vendidas = Number(nrqItem.valor) || 0;
      totalNrqVendidas += vendidas;
      if (recetas.length === 0) continue;

      for (const receta of recetas) {
        const mp = receta.materiaPrima;
        if (!mp) continue;
        const dosisXUnidad = Number(receta.cantidadDosis) || 0;
        const consumoTotalUnidadConsumo = dosisXUnidad * vendidas;
        const mpEnMapa = maquina.mapaMateriaPrima.find((m) => m.idProducto === mp.idProducto);

        const anterior = mpConsolidado.get(mp.idProducto);
        if (anterior) {
          anterior.consumoUnidadConsumo += consumoTotalUnidadConsumo;
          anterior.vendidasTotal += vendidas;
        } else {
          mpConsolidado.set(mp.idProducto, {
            mp,
            consumoUnidadConsumo: consumoTotalUnidadConsumo,
            idMapaMp: mpEnMapa?.idMapaMp,
            vendidasTotal: vendidas,
          });
        }
      }
    }

    for (const [, data] of mpConsolidado) {
      const { mp, consumoUnidadConsumo, idMapaMp } = data;
      const equivalencia = Number(mp.equivalencia) || 1;
      const capacidadUnidadesMapa = idMapaMp ? (mapaMpById.get(idMapaMp)?.capacidadMax ?? 0) : 0;
      const capacidadDotacionMaxUnidadConsumo =
        capacidadUnidadesMapa > 0 ? capacidadUnidadesMapa * equivalencia : equivalencia;

      const faltanteUnidadConsumo = Math.max(0, consumoUnidadConsumo);
      const cantSugeridaUnidadCompra = Math.ceil(faltanteUnidadConsumo / equivalencia);
      const fisicoEstimadoUnidadConsumo = Math.max(0, capacidadDotacionMaxUnidadConsumo - consumoUnidadConsumo);
      const fisicoDigitadoUnidadCompra = Math.round(fisicoEstimadoUnidadConsumo / equivalencia);

      const pedido = await this.prisma.pedidosOperador.create({
        data: {
          idMaquina: dto.idMaquina,
          idOperador: dto.idOperador,
          idProducto: mp.idProducto,
          idMapaMp: idMapaMp ?? null,
          fisicoDigitado: fisicoDigitadoUnidadCompra,
          cantSugerida: cantSugeridaUnidadCompra,
          nrqActualLectura: totalNrqVendidas ? BigInt(totalNrqVendidas) : null,
          estado: 'PENDIENTE',
        },
      });
      pedidosCreados.push(pedido);
    }

    return {
      totalCreados: pedidosCreados.length,
      pedidos: pedidosCreados,
      nrqItemsProcesados: dto.nrqItems?.length || 0,
      mpDesdeRecetas: mpConsolidado.size,
    };
  }
}
