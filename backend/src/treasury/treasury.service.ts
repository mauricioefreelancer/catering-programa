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
    // El NR es un contador ACUMULATIVO de valor en pesos (todo lo vendido por la máquina
    // desde que se configuró). Por lo tanto la diferencia NR ya ES la venta del periodo
    // en dinero (efectivo + tarjetas + veos + datafono + cupos), SIN multiplicar por tarifa.
    // El nr actual siempre debe ser >= nr anterior (no tiene lógica vender en negativo).
    if (dto.nrActual !== undefined && dto.nrActual !== null && Number(dto.nrActual) < nrAnterior) {
      throw new BadRequestException(`El NR actual (${nrActual}) no puede ser menor al NR anterior acumulado (${nrAnterior})`);
    }
    const totalVendido = diferenciaNr; // valor en pesos vendidos en el periodo
    const veos = Math.max(0, Number(dto.veosRecog ?? 0));
    const datafono = Math.max(0, Number(dto.datafonoRecog ?? 0));
    const cupos = Math.max(0, Number(dto.cuposRecog ?? 0));
    const mediosNoEfectivo = veos + datafono + cupos;
    const efectivoEsperado = Math.max(0, totalVendido - mediosNoEfectivo);
    // Si se digitó el efectivo que trae el operador, el recaudo queda cerrado;
    // de lo contrario queda PENDIENTE hasta completarse.
    const tieneEfectivo = dto.efectivoRecog !== undefined && dto.efectivoRecog !== null;
    const efectivoRecog = tieneEfectivo ? Math.max(0, Number(dto.efectivoRecog)) : 0;

    // El efectivo recogido se desglosa en BILLETES y MONEDAS (el operador entrega por
    // separado). Su suma debe coincidir con el efectivo total recogido.
    const tieneSplit =
      (dto.efectivoBilletes !== undefined && dto.efectivoBilletes !== null) ||
      (dto.efectivoMonedas !== undefined && dto.efectivoMonedas !== null);
    let efectivoBilletes = 0;
    let efectivoMonedas = 0;
    if (tieneSplit) {
      efectivoBilletes = Math.max(0, Number(dto.efectivoBilletes ?? 0));
      efectivoMonedas = Math.max(0, Number(dto.efectivoMonedas ?? 0));
      const sumaSplit = efectivoBilletes + efectivoMonedas;
      if (tieneEfectivo && Math.abs(sumaSplit - efectivoRecog) > 0.001) {
        throw new BadRequestException(
          `La suma de Billetes + Monedas (${sumaSplit.toFixed(2)}) debe coincidir con el Efectivo Recogido (${efectivoRecog.toFixed(2)})`,
        );
      }
    } else if (tieneEfectivo) {
      // Recaudos existentes / compatibilidad: si solo se conoce el efectivo total, se asume en billetes.
      efectivoBilletes = efectivoRecog;
    }
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
        efectivoBilletes: new Prisma.Decimal(efectivoBilletes),
        efectivoMonedas: new Prisma.Decimal(efectivoMonedas),
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
      select: { idGrupo: true, idRecaudo: true, estado: true, efectivoEsperado: true, efectivoRecog: true, efectivoBilletes: true, efectivoMonedas: true, veosRecog: true, datafonoRecog: true, cuposRecog: true },
    });
    const recAudados = new Map(gruposRecaudados.map((r) => [r.idGrupo, r]));

    // 5) Adjuntar máquina y operador
    const idsMaq = [...new Set(visitas.map((v) => v.idMaquina))];
    const idsOp = [...new Set(visitas.map((v) => v.idOperador))];
    const [maqs, ops] = await Promise.all([
      this.prisma.maquinasYTiendas.findMany({ where: { idMaquina: { in: idsMaq } }, select: { idMaquina: true, serial: true, ubicacionEsp: true, mediosPago: true, tarifaPromedioOverride: true, idCliente: true } }),
      this.prisma.operadores.findMany({ where: { idOperador: { in: idsOp } }, select: { idOperador: true, nombreCompleto: true, zonaAsignada: true } }),
    ]);
    const maqMap = new Map(maqs.map((m) => [m.idMaquina, m]));
    const opMap = new Map(ops.map((o) => [o.idOperador, o]));

    // 6) Total Despachado por visita (= Σ cantidad sugerida de cada producto de la
    // visita x precio de venta asignado al cliente). Si el cliente no tiene precio
    // configurado para el producto, se usa el costo base; si tampoco hay, 0.
    const visitasIds = visitas.map((v) => v.idGrupo);
    const pedidosVisita = visitasIds.length
      ? await this.prisma.pedidosOperador.findMany({
          where: { idGrupo: { in: visitasIds } },
          select: { idGrupo: true, idProducto: true, cantSugerida: true },
        })
      : [];
    // Cliente al que pertenece cada máquina de las visitas
    const clientesDeVisita = new Map<number, number | null>();
    for (const v of visitas) clientesDeVisita.set(v.idGrupo, maqMap.get(v.idMaquina)?.idCliente ?? null);
    // Precios por (cliente, producto) que abarquen todos los clientes/productos de las visitas
    const productosVisita = [...new Set(pedidosVisita.map((p) => p.idProducto))];
    const clientesVisita = [...new Set([...clientesDeVisita.values()].filter((c): c is number => c != null))];
    const preciosPorClienteProducto = new Map<string, number>();
    if (productosVisita.length && clientesVisita.length) {
      const precios = await this.prisma.preciosCliente.findMany({
        where: { idProducto: { in: productosVisita }, idCliente: { in: clientesVisita } },
        select: { idCliente: true, idProducto: true, precioVenta: true },
      });
      for (const pr of precios) preciosPorClienteProducto.set(`${pr.idCliente}_${pr.idProducto}`, Number(pr.precioVenta));
    }
    // Costo base por producto (fallback cuando el cliente no tiene precio configurado)
    const costoBasePorProducto = new Map<number, number>();
    if (productosVisita.length) {
      const prods = await this.prisma.productos.findMany({
        where: { idProducto: { in: productosVisita } },
        select: { idProducto: true, costoBase: true },
      });
      for (const pr of prods) costoBasePorProducto.set(pr.idProducto, Number(pr.costoBase));
    }
    // Acumula el total despachado por idGrupo
    const totalDespachadoPorVisita = new Map<number, number>();
    for (const p of pedidosVisita) {
      if (p.idGrupo == null) continue;
      const idCliente = clientesDeVisita.get(p.idGrupo) ?? null;
      const precio =
        idCliente != null
          ? preciosPorClienteProducto.get(`${idCliente}_${p.idProducto}`) ?? costoBasePorProducto.get(p.idProducto) ?? 0
          : costoBasePorProducto.get(p.idProducto) ?? 0;
      const cantidad = Number(p.cantSugerida) || 0;
      totalDespachadoPorVisita.set(p.idGrupo, (totalDespachadoPorVisita.get(p.idGrupo) ?? 0) + cantidad * precio);
    }

    // La tarifa queda obsoleta: el NR ya es venta en dinero acumulada.
    // (Se mantiene la consulta de máquinas sin tarifa para no romper la respuesta.)

    const lista = visitas
      .map((v) => {
        const recaudo = recAudados.get(v.idGrupo);
        const diferenciaNR = Math.max(0, v.nrActual - v.nrAnterior);
        const est = { ...recaudo, mediosPago: maqMap.get(v.idMaquina)?.mediosPago ?? null };
        return {
          idGrupo: v.idGrupo,
          idMaquina: v.idMaquina,
          idOperador: v.idOperador,
          fechaVisita: v.fechaVisita,
          nrAnterior: v.nrAnterior,
          nrActual: v.nrActual,
          diferenciaNR,
          totalVendido: diferenciaNR, // NR acumulado de valor en $: la diferencia ya es venta en dinero
          totalDespachado: totalDespachadoPorVisita.get(v.idGrupo) ?? 0,
          maquina: maqMap.get(v.idMaquina) ?? null,
          operador: opMap.get(v.idOperador) ?? null,
          estado: est?.estado ?? 'PENDIENTE',
          idRecaudo: est?.idRecaudo ?? null,
          recaudoGuardado: est?.idRecaudo
            ? {
                idRecaudo: est.idRecaudo,
                estado: est.estado,
                efectivoEsperado: Number(est.efectivoEsperado || 0),
                efectivoRecog: Number(est.efectivoRecog || 0),
                efectivoBilletes: Number(est.efectivoBilletes || 0),
                efectivoMonedas: Number(est.efectivoMonedas || 0),
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

  // "Vendido por Visita": mapea las ventas de cada máquina en cada visita del operador,
  // mostrando el total despachado (= Σ cantidad sugerida x precio del cliente) junto al
  // total vendido (diferencia NR). FiltrA por fecha, máquina y/o cliente.
  async vendidoPorVisita(query: any) {
    const fechaInicio = query?.fechaInicio ? new Date(query.fechaInicio + 'T00:00:00') : null;
    const fechaFin = query?.fechaFin ? new Date(query.fechaFin + 'T23:59:59') : null;
    const idMaquina = query?.idMaquina ? Number(query.idMaquina) : undefined;
    const idCliente = query?.idCliente ? Number(query.idCliente) : undefined;

    // 1) Pedidos con lectura NR (visitas) dentro del rango de fechas
    const wherePedidos: any = { nrActualMedido: { not: null } };
    if (fechaInicio && fechaFin) wherePedidos.fechaHora = { gte: fechaInicio, lte: fechaFin };
    if (idMaquina) wherePedidos.idMaquina = idMaquina;
    const pedidos = await this.prisma.pedidosOperador.findMany({
      where: wherePedidos,
      select: { idGrupo: true, idMaquina: true, idOperador: true, idProducto: true, idMapaMp: true, fechaHora: true, nrActualMedido: true, cantSugerida: true },
      orderBy: { fechaHora: 'asc' },
    });

    // 2) Agrupar por idGrupo (visita)
    type Visita = { idGrupo: number; idMaquina: number; idOperador: number; fechaVisita: Date; nrActual: number; nrAnterior: number };
    const mapa = new Map<number, Visita>();
    for (const p of pedidos) {
      if (p.idGrupo == null) continue;
      const nr = Number(p.nrActualMedido) || 0;
      const act = mapa.get(p.idGrupo);
      if (!act) {
        mapa.set(p.idGrupo, { idGrupo: p.idGrupo, idMaquina: p.idMaquina, idOperador: p.idOperador, fechaVisita: p.fechaHora, nrActual: nr, nrAnterior: 0 });
      } else {
        if (p.fechaHora < act.fechaVisita) act.fechaVisita = p.fechaHora;
        if (nr > act.nrActual) act.nrActual = nr;
      }
    }
    const visitas = [...mapa.values()].sort((a, b) => a.fechaVisita.getTime() - b.fechaVisita.getTime());

    // 3) NR anterior por máquina usando la historia COMPLETA (sin limitarse a la ventana
    // de fechas filtrada), de modo que el "total vendido" sea estable y coherente sin
    // importar el rango de fechas o el filtro de cliente/máquina elegido.
    const maquinasDeVisitas = [...new Set(visitas.map((v) => v.idMaquina))];
    const historiaNr = maquinasDeVisitas.length
      ? await this.prisma.pedidosOperador.findMany({
          where: { idMaquina: { in: maquinasDeVisitas }, nrActualMedido: { not: null } },
          select: { idGrupo: true, idMaquina: true, fechaHora: true, nrActualMedido: true },
          orderBy: [{ idMaquina: 'asc' }, { fechaHora: 'asc' }],
        })
      : [];
    const ultimoNrPorMaquina = new Map<number, number>();
    const nrAnteriorPorVisita = new Map<number, number>();
    const nrChequeado = new Set<number>();
    for (const h of historiaNr) {
      if (h.idGrupo == null) continue;
      if (!nrChequeado.has(h.idGrupo)) {
        nrAnteriorPorVisita.set(h.idGrupo, ultimoNrPorMaquina.get(h.idMaquina) ?? 0);
        nrChequeado.add(h.idGrupo);
      }
      const nrH = Number(h.nrActualMedido) || 0;
      if (nrH > (ultimoNrPorMaquina.get(h.idMaquina) ?? 0)) ultimoNrPorMaquina.set(h.idMaquina, nrH);
    }
    for (const v of visitas) v.nrAnterior = nrAnteriorPorVisita.get(v.idGrupo) ?? 0;

    // 4) Máquinas y operadores de las visitas
    const idsMaq = [...new Set(visitas.map((v) => v.idMaquina))];
    const idsOp = [...new Set(visitas.map((v) => v.idOperador))];
    const [maqs, ops] = await Promise.all([
      this.prisma.maquinasYTiendas.findMany({ where: { idMaquina: { in: idsMaq } }, select: { idMaquina: true, serial: true, ubicacionEsp: true, idCliente: true } }),
      this.prisma.operadores.findMany({ where: { idOperador: { in: idsOp } }, select: { idOperador: true, nombreCompleto: true, zonaAsignada: true } }),
    ]);
    const maqMap = new Map(maqs.map((m) => [m.idMaquina, m]));
    const opMap = new Map(ops.map((o) => [o.idOperador, o]));

    // 5) Filtrar por cliente (la máquina pertenece a un cliente)
    const visitasFiltradas = visitas.filter((v) => {
      if (idCliente == null) return true;
      return maqMap.get(v.idMaquina)?.idCliente === idCliente;
    });
    const visitasIds = visitasFiltradas.map((v) => v.idGrupo);

    // 6) Detalle de productos por visita + precios + costo base para el total despachado.
    // El "total despachado" del informe se calcula con lo EFECTIVAMENTE despachado desde
    // DESPACHOS_BODEGA (no el faltante teórico), porque bodega puede no tener suficiente
    // stock para todas las máquinas. Así cuadra con lo que bodega realmente envió.
    const pedidosVisita = visitasIds.length
      ? await this.prisma.pedidosOperador.findMany({
          where: { idGrupo: { in: visitasIds } },
          select: {
            idGrupo: true,
            idProducto: true,
            cantSugerida: true,
            despachosBodega: { select: { cantDespachada: true } },
          },
        })
      : [];
    const totalDespachadoPorVisita = new Map<number, number>();
    const totalSugeridoPorVisita = new Map<number, number>();
    const totalPendientePorVisita = new Map<number, number>();
    const totalVendidoProductosPorVisita = new Map<number, number>();
    const totalCantidadPorVisita = new Map<number, number>();
    const pendientePorProductoVisita = new Map<number, Map<number, number>>();
    const despachadoPorProductoVisita = new Map<number, Map<number, number>>();
    const vendidoPorProductoVisita = new Map<number, Record<number, number>>();
    const clientesDeVisita = new Map<number, number | null>();
    for (const v of visitasFiltradas) clientesDeVisita.set(v.idGrupo, maqMap.get(v.idMaquina)?.idCliente ?? null);

    const productosVisita = [...new Set(pedidosVisita.map((p) => p.idProducto))];
    const clientesVisita = [...new Set([...clientesDeVisita.values()].filter((c): c is number => c != null))];
    const preciosPorClienteProducto = new Map<string, number>();
    if (productosVisita.length && clientesVisita.length) {
      const precios = await this.prisma.preciosCliente.findMany({
        where: { idProducto: { in: productosVisita }, idCliente: { in: clientesVisita } },
        select: { idCliente: true, idProducto: true, precioVenta: true },
      });
      for (const pr of precios) preciosPorClienteProducto.set(`${pr.idCliente}_${pr.idProducto}`, Number(pr.precioVenta));
    }
    const costoBasePorProducto = new Map<number, number>();
    if (productosVisita.length) {
      const prods = await this.prisma.productos.findMany({ where: { idProducto: { in: productosVisita } }, select: { idProducto: true, costoBase: true } });
      for (const pr of prods) costoBasePorProducto.set(pr.idProducto, Number(pr.costoBase));
    }
    for (const p of pedidosVisita) {
      if (p.idGrupo == null) continue;
      const idClienteActual = clientesDeVisita.get(p.idGrupo) ?? null;
      const precio =
        idClienteActual != null
          ? preciosPorClienteProducto.get(`${idClienteActual}_${p.idProducto}`) ?? costoBasePorProducto.get(p.idProducto) ?? 0
          : costoBasePorProducto.get(p.idProducto) ?? 0;
      const sugerido = Number(p.cantSugerida) || 0;
      const despachadoReal = p.despachosBodega.reduce((acc: number, d) => acc + d.cantDespachada, 0);
      const pendiente = Math.max(0, sugerido - despachadoReal);

      totalSugeridoPorVisita.set(p.idGrupo, (totalSugeridoPorVisita.get(p.idGrupo) ?? 0) + sugerido * precio);
      totalDespachadoPorVisita.set(p.idGrupo, (totalDespachadoPorVisita.get(p.idGrupo) ?? 0) + despachadoReal * precio);
      totalPendientePorVisita.set(p.idGrupo, (totalPendientePorVisita.get(p.idGrupo) ?? 0) + pendiente * precio);
      // Total vendido por productos = lo efectivamente cubierto (sugerido - pendiente),
      // es decir lo que sí se considera vendido porque se repuso. El pendiente NO es venta.
      totalVendidoProductosPorVisita.set(p.idGrupo, (totalVendidoProductosPorVisita.get(p.idGrupo) ?? 0) + (sugerido - pendiente) * precio);
      totalCantidadPorVisita.set(p.idGrupo, (totalCantidadPorVisita.get(p.idGrupo) ?? 0) + sugerido);

      // Desglose por producto: despachado real y pendiente por reponer.
      const despMap = despachadoPorProductoVisita.get(p.idGrupo) ?? new Map<number, number>();
      despMap.set(p.idProducto, (despMap.get(p.idProducto) ?? 0) + despachadoReal);
      despachadoPorProductoVisita.set(p.idGrupo, despMap);
      const pendMap = pendientePorProductoVisita.get(p.idGrupo) ?? new Map<number, number>();
      pendMap.set(p.idProducto, (pendMap.get(p.idProducto) ?? 0) + pendiente);
      pendientePorProductoVisita.set(p.idGrupo, pendMap);

      // Subtotal VENDIDO por producto = (sugerido − pendiente) × precio; NO cuenta el pendiente.
      const vendMap = vendidoPorProductoVisita.get(p.idGrupo) ?? {};
      vendMap[p.idProducto] = (vendMap[p.idProducto] ?? 0) + (sugerido - pendiente) * precio;
      vendidoPorProductoVisita.set(p.idGrupo, vendMap);
    }

    // 7) Ensamblar respuesta con desglose por producto
    const detallePorVisita = new Map<number, any[]>();
    for (const p of pedidosVisita) {
      if (p.idGrupo == null) continue;
      const idClienteActual = clientesDeVisita.get(p.idGrupo) ?? null;
      const precio =
        idClienteActual != null
          ? preciosPorClienteProducto.get(`${idClienteActual}_${p.idProducto}`) ?? costoBasePorProducto.get(p.idProducto) ?? 0
          : costoBasePorProducto.get(p.idProducto) ?? 0;
      const sugerido = Number(p.cantSugerida) || 0;
      const despachadoReal = p.despachosBodega.reduce((acc: number, d) => acc + d.cantDespachada, 0);
      const pendiente = Math.max(0, sugerido - despachadoReal);
      const arr = detallePorVisita.get(p.idGrupo) ?? [];
      arr.push({
        idProducto: p.idProducto,
        cantidadSugerida: sugerido,
        despachado: despachadoReal,
        pendiente,
        precio,
        subtotal: despachadoReal * precio,
        subtotalVendido: (sugerido - pendiente) * precio,
      });
      detallePorVisita.set(p.idGrupo, arr);
    }

    // 8) Persistir (backfill) los totales de visitas que aún no tienen registro en
    // VENTAS_POR_VISITA. Una vez guardada, la visita queda inmutable en la BD.
    // Se toleran errores de concurrencia (P2002) para no perder la consulta ni los datos.
    for (const v of visitasFiltradas) {
      const diferenciaNR = Math.max(0, v.nrActual - v.nrAnterior);
      try {
        await this.prisma.ventasPorVisita.upsert({
          where: { idGrupo: v.idGrupo },
          create: {
            idGrupo: v.idGrupo,
            idMaquina: v.idMaquina,
            idCliente: maqMap.get(v.idMaquina)?.idCliente ?? null,
            idOperador: v.idOperador,
            fechaVisita: v.fechaVisita,
            nrAnterior: BigInt(v.nrAnterior),
            nrActual: BigInt(v.nrActual),
            totalVendido: new Prisma.Decimal(diferenciaNR),
            totalDespachado: new Prisma.Decimal(totalDespachadoPorVisita.get(v.idGrupo) ?? 0),
            totalVendidoProductos: new Prisma.Decimal(totalVendidoProductosPorVisita.get(v.idGrupo) ?? 0),
            unidadesSugeridas: totalCantidadPorVisita.get(v.idGrupo) ?? 0,
            detalle: detallePorVisita.get(v.idGrupo) ?? [],
            firmaOrigen: 'BACKFILL',
          },
          // Actualiza solo el "Total_Vendido_Productos" real (depende del despacho, que ocurre
          // después del registro) sin alterar el NR ni los demás totales del histórico.
          update: { totalVendidoProductos: new Prisma.Decimal(totalVendidoProductosPorVisita.get(v.idGrupo) ?? 0) },
        });
      } catch {
        // Concurrencia (P2002) o error transitorio: no se detiene la consulta. La visita
        // se devuelve esta llamada desde el cálculo en vivo y el guardado se reintenta en
        // la próxima consulta. Así nunca se pierde la respuesta ni los datos calculados.
      }
    }

    // 9) Leer los registros persistidos para devolver SIEMPRE el histórico inmutable
    const persistedMap = new Map<number, any>();
    const persisted = await this.prisma.ventasPorVisita.findMany({ where: { idGrupo: { in: visitasIds } } });
    for (const p of persisted) if (p.idGrupo != null) persistedMap.set(p.idGrupo, p);

    const idClienteNombreMap = new Map<number, string>();
    if (clientesVisita.length) {
      const cli = await this.prisma.clientes.findMany({ where: { idCliente: { in: clientesVisita } }, select: { idCliente: true, razonSocial: true } });
      for (const c of cli) idClienteNombreMap.set(c.idCliente, c.razonSocial);
    }

    const lista = visitasFiltradas
      .map((v) => {
        const reg = persistedMap.get(v.idGrupo);
        const maquina = maqMap.get(v.idMaquina) ?? null;
        const clienteId = maquina?.idCliente ?? null;
        return {
          idGrupo: v.idGrupo,
          idMaquina: v.idMaquina,
          serial: maquina?.serial ?? null,
          ubicacionEsp: maquina?.ubicacionEsp ?? null,
          idCliente: clienteId,
          cliente: clienteId != null ? idClienteNombreMap.get(clienteId) ?? null : null,
          idOperador: v.idOperador,
          operador: opMap.get(v.idOperador)?.nombreCompleto ?? `Op #${v.idOperador}`,
          zona: opMap.get(v.idOperador)?.zonaAsignada ?? null,
          fechaVisita: reg?.fechaVisita ?? v.fechaVisita,
          nrAnterior: reg ? Number(reg.nrAnterior) : v.nrAnterior,
          nrActual: reg ? Number(reg.nrActual) : v.nrActual,
          totalVendido: reg ? Number(reg.totalVendido) : Math.max(0, v.nrActual - v.nrAnterior),
          // El "total despachado" del informe es lo EFECTIVAMENTE despachado (desde
          // DESPACHOS_BODEGA), no el faltante teórico guardado en VENTAS_POR_VISITA.
          totalDespachado: totalDespachadoPorVisita.get(v.idGrupo) ?? 0,
          // "Total vendido productos" = Σ (sugerido − pendiente) × precio. Solo cuenta lo
          // repuesto realmente; el pendiente (deuda con la máquina) NO es venta.
          totalVendidoProductos: reg ? Number(reg.totalVendidoProductos ?? totalVendidoProductosPorVisita.get(v.idGrupo) ?? 0) : totalVendidoProductosPorVisita.get(v.idGrupo) ?? 0,
          totalSugerido: totalSugeridoPorVisita.get(v.idGrupo) ?? 0,
          totalPendiente: totalPendientePorVisita.get(v.idGrupo) ?? 0,
          unidadesSugeridas: totalCantidadPorVisita.get(v.idGrupo) ?? 0,
          detalle: detallePorVisita.get(v.idGrupo) ?? [],
          subtotalVendidoPorProducto: vendidoPorProductoVisita.get(v.idGrupo) ?? {},
        };
      })
      .sort((a, b) => b.fechaVisita.getTime() - a.fechaVisita.getTime());

    return {
      total: lista.length,
      totalDespachado: lista.reduce((s, r) => s + r.totalDespachado, 0),
      totalSugerido: lista.reduce((s, r) => s + r.totalSugerido, 0),
      totalPendiente: lista.reduce((s, r) => s + r.totalPendiente, 0),
      totalVendido: lista.reduce((s, r) => s + r.totalVendido, 0),
      totalVendidoProductos: lista.reduce((s, r) => s + (r.totalVendidoProductos ?? 0), 0),
      visitas: lista,
    };
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
    // Desglose en billetes/monedas. Si no se envían, se asume todo en billetes.
    const tieneSplit =
      (dto.efectivoBilletes !== undefined && dto.efectivoBilletes !== null) ||
      (dto.efectivoMonedas !== undefined && dto.efectivoMonedas !== null);
    let efectivoBilletes = r.efectivoBilletes ? Number(r.efectivoBilletes) : 0;
    let efectivoMonedas = r.efectivoMonedas ? Number(r.efectivoMonedas) : 0;
    if (tieneSplit) {
      efectivoBilletes = Math.max(0, Number(dto.efectivoBilletes ?? 0));
      efectivoMonedas = Math.max(0, Number(dto.efectivoMonedas ?? 0));
      const sumaSplit = efectivoBilletes + efectivoMonedas;
      if (Math.abs(sumaSplit - efectivoRecog) > 0.001) {
        throw new BadRequestException(
          `La suma de Billetes + Monedas (${sumaSplit.toFixed(2)}) debe coincidir con el Efectivo Recogido (${efectivoRecog.toFixed(2)})`,
        );
      }
    } else {
      efectivoBilletes = efectivoRecog;
      efectivoMonedas = 0;
    }
    const efectivoEsperado = Number(r.efectivoEsperado || 0);
    const diferenciaRec = efectivoRecog - efectivoEsperado;
    return this.prisma.tesoreriaEfectivoNr.update({
      where: { idRecaudo: id },
      data: {
        efectivoRecog: new Prisma.Decimal(efectivoRecog),
        efectivoBilletes: new Prisma.Decimal(efectivoBilletes),
        efectivoMonedas: new Prisma.Decimal(efectivoMonedas),
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
