import { Injectable, NotFoundException, MethodNotAllowedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEfectivoNrDto, CompletarEfectivoNrDto, CreateSaldoDigitalDto, UpdateSaldoDigitalDto, QueryFacturacionNrqDto } from './dto/treasury.dto';
import { Prisma } from '@prisma/client';
import { umbralDiferenciaVenta } from '../common/contadores';
import { rangoColombia } from '../common/fecha-colombia';

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  async createEfectivoNr(dto: CreateEfectivoNrDto) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "ID_Visita" FROM "VISITAS" WHERE "ID_Visita" = ${dto.idGrupo} FOR UPDATE`;
    const visita = await tx.visitas.findUnique({ where: { idVisita: dto.idGrupo }, include: { recaudo: true } });
    if (!visita) throw new NotFoundException('Visita no encontrada');
    if (visita.recaudo) throw new BadRequestException(`La visita ${dto.idGrupo} ya tiene un recaudo (#${visita.recaudo.idRecaudo})`);
    if (visita.idMaquina !== dto.idMaquina || visita.idOperador !== dto.idOperador ||
        visita.estado === 'ANULADA' || visita.nrEfectivoActual == null || visita.ventaNr == null) {
      throw new BadRequestException('La visita no coincide con la máquina y el operador o no tiene una venta válida');
    }
    const totalVendido = new Prisma.Decimal(visita.ventaNr.toString());
    const veos = Math.max(0, Number(dto.veosRecog ?? 0));
    const datafono = Math.max(0, Number(dto.datafonoRecog ?? 0));
    const cupos = Math.max(0, Number(dto.cuposRecog ?? 0));
    const nequi = dto.nequiRecog ?? 0;
    const mediosNoEfectivo = new Prisma.Decimal(veos).plus(datafono).plus(cupos).plus(nequi);
    const efectivoEsperado = Prisma.Decimal.max(0, totalVendido.minus(mediosNoEfectivo));
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
    const diferenciaRec = new Prisma.Decimal(efectivoRecog).minus(efectivoEsperado);

    const recaudo = await tx.tesoreriaEfectivoNr.create({
      data: {
        idGrupo: dto.idGrupo ?? null,
        idMaquina: dto.idMaquina,
        idOperador: dto.idOperador,
        idUsuario: dto.idUsuario,
        fechaHora: dto.fechaHora ? new Date(dto.fechaHora) : new Date(),
        nrAnterior: visita.nrEfectivoAnterior ?? 0n,
        nrActual: visita.nrEfectivoActual,
        diferenciaNr: visita.ventaNr,
        efectivoTeorico: totalVendido,
        totalVendido,
        veosRecog: new Prisma.Decimal(veos),
        datafonoRecog: new Prisma.Decimal(datafono),
        nequiRecog: new Prisma.Decimal(nequi),
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
    if (estado === 'CERRADO') {
      await tx.visitas.update({ where: { idVisita: visita.idVisita }, data: { estado: 'RECAUDADA' } });
    }
    return recaudo;
    });
  }

  // Lista las visitas/pedidos (grupos) del operador con su NR, para cerrar el recaudo por visita
  async listarVisitasRecaudo(query: any) {
    const idOperador = query?.idOperador ? Number(query.idOperador) : undefined;
    const idMaquina = query?.idMaquina ? Number(query.idMaquina) : undefined;
    const soloPendientes = query?.soloPendientes === 'true' || query?.soloPendientes === true;

    const pagina = Number(query?.pagina ?? 1);
    const limite = Number(query?.limite ?? 25);
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000 ||
        !Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new BadRequestException('Paginación inválida');
    }
    const { desde, hasta } = rangoColombia(query?.fechaInicio, query?.fechaFin);
    const where: Prisma.VisitasWhereInput = {
      idOperador, idMaquina, estado: { not: 'ANULADA' }, ventaNr: { not: null },
      fechaVisita: { gte: desde, lt: hasta },
      ...(soloPendientes ? { OR: [{ recaudo: null }, { recaudo: { estado: 'PENDIENTE' } }] } : {}),
    };
    const [total, cabeceras] = await this.prisma.$transaction([
      this.prisma.visitas.count({ where }),
      this.prisma.visitas.findMany({
        where, include: { recaudo: true }, orderBy: [{ fechaVisita: 'desc' }, { idVisita: 'desc' }],
        skip: (pagina - 1) * limite, take: limite,
      }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const visitas = cabeceras.map(v => ({
      ...v, idGrupo: v.idVisita, nrActual: Number(v.nrEfectivoActual ?? 0n),
      nrAnterior: Number(v.nrEfectivoAnterior ?? 0n),
    }));

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
    for (const v of visitas) clientesDeVisita.set(v.idGrupo, v.idCliente);
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
        const recaudo = v.recaudo;
        const diferenciaNR = Number(v.ventaNr);
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
                nequiRecog: Number(est.nequiRecog || 0),
                cuposRecog: Number(est.cuposRecog || 0),
              }
            : null,
        };
      });

    return { total, pagina, limite, visitas: lista };
  }

  // "Vendido por Visita": mapea las ventas de cada máquina en cada visita del operador,
  // mostrando el total despachado (= Σ cantidad sugerida x precio del cliente) junto al
  // total vendido (diferencia NR). FiltrA por fecha, máquina y/o cliente.
  async vendidoPorVisita(query: any) {
    const { desde, hasta } = rangoColombia(query?.fechaInicio, query?.fechaFin);
    const idMaquina = query?.idMaquina ? Number(query.idMaquina) : undefined;
    const idCliente = query?.idCliente ? Number(query.idCliente) : undefined;

    // La cabecera existe incluso cuando la visita no genera reposición.
    const cabeceras = await this.prisma.visitas.findMany({
      where: {
        idMaquina,
        idCliente,
        nrEfectivoActual: { not: null },
        fechaVisita: { gte: desde, lt: hasta },
      },
      orderBy: [{ fechaVisita: 'asc' }, { idVisita: 'asc' }],
    });
    const visitasFiltradas = cabeceras.map(v => ({
      idGrupo: v.idVisita, idMaquina: v.idMaquina, idOperador: v.idOperador,
      idCliente: v.idCliente, fechaVisita: v.fechaVisita,
      nrActual: Number(v.nrEfectivoActual ?? 0n), nrAnterior: Number(v.nrEfectivoAnterior ?? 0n),
      ventaNr: Number(v.ventaNr ?? 0n),
    }));

    const idsMaq = [...new Set(visitasFiltradas.map((v) => v.idMaquina))];
    const idsOp = [...new Set(visitasFiltradas.map((v) => v.idOperador))];
    const [maqs, ops] = await Promise.all([
      this.prisma.maquinasYTiendas.findMany({ where: { idMaquina: { in: idsMaq } }, select: { idMaquina: true, serial: true, ubicacionEsp: true, idCliente: true } }),
      this.prisma.operadores.findMany({ where: { idOperador: { in: idsOp } }, select: { idOperador: true, nombreCompleto: true, zonaAsignada: true } }),
    ]);
    const maqMap = new Map(maqs.map((m) => [m.idMaquina, m]));
    const opMap = new Map(ops.map((o) => [o.idOperador, o]));

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
            estado: true,
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
    for (const v of visitasFiltradas) clientesDeVisita.set(v.idGrupo, v.idCliente);

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
      const pendiente = p.estado === 'PENDIENTE' || p.estado === 'PARCIAL'
        ? Math.max(0, sugerido - despachadoReal) : 0;

      totalSugeridoPorVisita.set(p.idGrupo, (totalSugeridoPorVisita.get(p.idGrupo) ?? 0) + sugerido * precio);
      totalDespachadoPorVisita.set(p.idGrupo, (totalDespachadoPorVisita.get(p.idGrupo) ?? 0) + despachadoReal * precio);
      totalPendientePorVisita.set(p.idGrupo, (totalPendientePorVisita.get(p.idGrupo) ?? 0) + pendiente * precio);
      // Total vendido por productos = lo efectivamente cubierto (sugerido - pendiente),
      // es decir lo que sí se considera vendido porque se repuso. El pendiente NO es venta.
      const cubierto = Math.min(sugerido, despachadoReal);
      totalVendidoProductosPorVisita.set(p.idGrupo, (totalVendidoProductosPorVisita.get(p.idGrupo) ?? 0) + cubierto * precio);
      totalCantidadPorVisita.set(p.idGrupo, (totalCantidadPorVisita.get(p.idGrupo) ?? 0) + sugerido);

      // Desglose por producto: despachado real y pendiente por reponer.
      const despMap = despachadoPorProductoVisita.get(p.idGrupo) ?? new Map<number, number>();
      despMap.set(p.idProducto, (despMap.get(p.idProducto) ?? 0) + despachadoReal);
      despachadoPorProductoVisita.set(p.idGrupo, despMap);
      const pendMap = pendientePorProductoVisita.get(p.idGrupo) ?? new Map<number, number>();
      pendMap.set(p.idProducto, (pendMap.get(p.idProducto) ?? 0) + pendiente);
      pendientePorProductoVisita.set(p.idGrupo, pendMap);

      // Valor legado del informe; calcular sobre despachos y no sobre el pendiente operativo.
      const vendMap = vendidoPorProductoVisita.get(p.idGrupo) ?? {};
      vendMap[p.idProducto] = (vendMap[p.idProducto] ?? 0) + cubierto * precio;
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
      const pendiente = p.estado === 'PENDIENTE' || p.estado === 'PARCIAL'
        ? Math.max(0, sugerido - despachadoReal) : 0;
      const arr = detallePorVisita.get(p.idGrupo) ?? [];
      arr.push({
        idProducto: p.idProducto,
        cantidadSugerida: sugerido,
        despachado: despachadoReal,
        pendiente,
        precio,
        subtotal: despachadoReal * precio,
        subtotalVendido: Math.min(sugerido, despachadoReal) * precio,
      });
      detallePorVisita.set(p.idGrupo, arr);
    }

    // El informe no modifica los registros históricos.
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
        const clienteId = v.idCliente;
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
          totalVendido: reg ? Number(reg.totalVendido) : v.ventaNr,
          // El "total despachado" del informe es lo EFECTIVAMENTE despachado (desde
          // DESPACHOS_BODEGA), no el faltante teórico guardado en VENTAS_POR_VISITA.
          totalDespachado: totalDespachadoPorVisita.get(v.idGrupo) ?? 0,
          // "Total vendido productos" = Σ (sugerido − pendiente) × precio. Solo cuenta lo
          // repuesto realmente; el pendiente (deuda con la máquina) NO es venta.
          totalVendidoProductos: reg?.firmaOrigen === 'CONTADORES' ? Number(reg.totalVendidoProductos) : totalVendidoProductosPorVisita.get(v.idGrupo) ?? 0,
          ventaTeoricaProductos: reg?.ventaTeoricaProductos == null ? null : Number(reg.ventaTeoricaProductos),
          diferenciaVenta: reg?.diferenciaVenta == null ? null : Number(reg.diferenciaVenta),
          alertaVenta: reg?.diferenciaVenta != null && Math.abs(Number(reg.diferenciaVenta)) >= umbralDiferenciaVenta(process.env.UMBRAL_DIFERENCIA_VENTA_COP),
          diferenciaUnidades: reg?.diferenciaUnidades == null ? null : Number(reg.diferenciaUnidades),
          unidadesNrProducto: reg?.unidadesNrProducto == null ? null : Number(reg.unidadesNrProducto),
          valorFacturarCliente: reg?.valorFacturarCliente == null ? null : Number(reg.valorFacturarCliente),
          controlesEspiral: reg?.detalle?.controles ?? [],
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
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "ID_Recaudo" FROM "TESORERIA_EFECTIVO_NR" WHERE "ID_Recaudo" = ${id} FOR UPDATE`;
    const r = await tx.tesoreriaEfectivoNr.findUnique({ where: { idRecaudo: id } });
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
    const diferenciaRec = new Prisma.Decimal(efectivoRecog).minus(r.efectivoEsperado);
    const recaudo = await tx.tesoreriaEfectivoNr.update({
      where: { idRecaudo: id },
      data: {
        efectivoRecog: new Prisma.Decimal(efectivoRecog),
        efectivoBilletes: new Prisma.Decimal(efectivoBilletes),
        efectivoMonedas: new Prisma.Decimal(efectivoMonedas),
        diferenciaRec: new Prisma.Decimal(diferenciaRec),
        estado: 'CERRADO',
      },
    });
    if (r.idGrupo != null) {
      await tx.visitas.update({ where: { idVisita: r.idGrupo }, data: { estado: 'RECAUDADA' } });
    }
    return recaudo;
    });
  }

  async removeEfectivoNr(_id: number) {
    throw new MethodNotAllowedException('DELETE no permitido para registros de tesorería cerrados');
  }

  async findAllSaldos() {
    return this.prisma.saldosDigitales.findMany({
      include: {
        maquina: { select: { serial: true, ubicacionEsp: true } },
        usuario: { select: { idUsuario: true } },
        visita: { select: { idVisita: true, fechaVisita: true, recaudo: { select: { idRecaudo: true, estado: true } } } },
      },
      orderBy: { fechaTransaccion: 'desc' },
    });
  }

  async createSaldo(dto: CreateSaldoDigitalDto) {
    return this.prisma.$transaction(async tx => {
    await this.validarVisitaSaldo(tx, dto.idMaquina, dto.idVisita);
    return tx.saldosDigitales.create({
      data: {
        idMaquina: dto.idMaquina,
        plataforma: dto.plataforma,
        montoTransaccion: new Prisma.Decimal(dto.montoTransaccion),
        fechaTransaccion: dto.fechaTransaccion ? new Date(dto.fechaTransaccion) : new Date(),
        referencia: dto.referencia ?? null,
        idUsuario: dto.idUsuario,
        idVisita: dto.idVisita,
      },
    });
    });
  }

  async updateSaldo(id: number, dto: UpdateSaldoDigitalDto) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "ID_Saldo" FROM "SALDOS_DIGITALES" WHERE "ID_Saldo" = ${id} FOR UPDATE`;
    const s = await tx.saldosDigitales.findUnique({ where: { idSaldo: id } });
    if (!s) throw new NotFoundException('Saldo no encontrado');
    await this.validarVisitaSaldo(tx, dto.idMaquina ?? s.idMaquina, dto.idVisita === undefined ? s.idVisita : dto.idVisita);
    const data: Prisma.SaldosDigitalesUncheckedUpdateInput = { ...dto };
    if (dto.montoTransaccion !== undefined) data.montoTransaccion = new Prisma.Decimal(dto.montoTransaccion);
    return tx.saldosDigitales.update({ where: { idSaldo: id }, data });
    });
  }

  private async validarVisitaSaldo(tx: Prisma.TransactionClient, idMaquina: number, idVisita?: number | null) {
    if (idVisita == null) return;
    const visita = await tx.visitas.findFirst({ where: { idVisita, idMaquina, estado: { not: 'ANULADA' } } });
    if (!visita) throw new BadRequestException('La visita debe estar vigente y pertenecer a la máquina del saldo');
  }

  async removeSaldo(id: number) {
    const s = await this.prisma.saldosDigitales.findUnique({ where: { idSaldo: id } });
    if (!s) throw new NotFoundException('Saldo no encontrado');
    return this.prisma.saldosDigitales.delete({ where: { idSaldo: id } });
  }

  async facturacionNrq(query: QueryFacturacionNrqDto) {
    const result = await this.lecturasFacturables(this.prisma, query);
    return {
      registros: result,
      totalDiferenciaNrq: result.reduce((acc, r) => acc + r.NRQ_Diferencia, 0n),
      totalFacturarEstimado: result.reduce((acc, r) => acc.plus(r.total), new Prisma.Decimal(0)),
    };
  }

  private async lecturasFacturables(tx: Prisma.TransactionClient, query: QueryFacturacionNrqDto) {
    const { desde, hasta } = rangoColombia(query.fechaInicio, query.fechaFin);
    if (!desde || !hasta) throw new BadRequestException('Indica el período de facturación');
    return tx.$queryRaw<{
      ID_Maquina: number; ID_Cliente: number | null; ID_Producto: number; Serial: string;
      Razon_Social: string | null; Nombre_Producto: string; incompleta: boolean;
      NRQ_Inicial: bigint; NRQ_Final: bigint; NRQ_Diferencia: bigint;
      Precio_Promedio: Prisma.Decimal; total: Prisma.Decimal;
    }[]>`
      WITH por_boton AS (
        SELECT v."ID_Maquina", v."ID_Cliente", l."ID_Prod_Term",
          (array_agg(l."Lectura_Anterior" ORDER BY v."Fecha_Visita", v."ID_Visita"))[1] AS inicial,
          (array_agg(l."Lectura_Actual" ORDER BY v."Fecha_Visita" DESC, v."ID_Visita" DESC))[1] AS final,
          SUM(l."Unidades") AS unidades, COALESCE(SUM(l."Subtotal"), 0) AS subtotal,
          bool_or(l."Unidades" > 0 AND l."Subtotal" IS NULL) AS incompleta
        FROM "LECTURAS_NRQ" l
        JOIN "VISITAS" v ON v."ID_Visita" = l."ID_Visita"
        WHERE v."Fecha_Visita" >= ${desde.toISOString()}::timestamp
          AND v."Fecha_Visita" < ${hasta.toISOString()}::timestamp
          AND v."Estado" <> 'ANULADA'
          AND (${query.idCliente ?? null}::int IS NULL OR v."ID_Cliente" = ${query.idCliente ?? null}::int)
          AND (${query.idProducto ?? null}::int IS NULL OR l."ID_Prod_Term" = ${query.idProducto ?? null}::int)
        GROUP BY v."ID_Maquina", v."ID_Cliente", l."ID_Prod_Term", l."ID_Mapa_NRQ", l."Opcion_Boton"
      )
      SELECT m."ID_Maquina", m."Serial", b."ID_Cliente", c."Razon_Social", p."ID_Producto", p."Nombre_Producto",
        SUM(b.inicial)::bigint AS "NRQ_Inicial", SUM(b.final)::bigint AS "NRQ_Final",
        SUM(b.unidades)::bigint AS "NRQ_Diferencia", SUM(b.subtotal) AS total,
        COALESCE(SUM(b.subtotal) / NULLIF(SUM(b.unidades), 0), 0) AS "Precio_Promedio",
        bool_or(b.incompleta OR b."ID_Cliente" IS NULL) AS incompleta
      FROM por_boton b
      JOIN "MAQUINAS_Y_TIENDAS" m ON m."ID_Maquina" = b."ID_Maquina"
      JOIN "PRODUCTOS" p ON p."ID_Producto" = b."ID_Prod_Term"
      LEFT JOIN "CLIENTES" c ON c."ID_Cliente" = b."ID_Cliente"
      GROUP BY m."ID_Maquina", m."Serial", b."ID_Cliente", c."Razon_Social", p."ID_Producto", p."Nombre_Producto"
      ORDER BY c."Razon_Social", m."Serial", p."Nombre_Producto"`;
  }

  async generarFacturacionNrq(query: QueryFacturacionNrqDto, idUsuario: number) {
    const { fechaInicio, fechaFin } = rangoColombia(query.fechaInicio, query.fechaFin);
    if (!fechaInicio || !fechaFin) throw new BadRequestException('Indica el período de facturación');
    return this.prisma.$transaction(async tx => {
      // Los generadores concurrentes verifican solapamientos de forma serializada.
      await tx.$executeRaw`LOCK TABLE "TESORERIA_FACTURACION_NRQ" IN SHARE ROW EXCLUSIVE MODE`;
      const filas = (await this.lecturasFacturables(tx, query)).filter(f => f.NRQ_Diferencia > 0n);
      if (!filas.length) throw new BadRequestException('No hay unidades NRQ facturables en este período');
      if (filas.some(f => f.incompleta)) throw new BadRequestException('Hay lecturas sin cliente o sin precio guardado');
      const pares = filas.map(f => ({ idMaquina: f.ID_Maquina, idProdTerm: f.ID_Producto }));
      if (new Set(pares.map(p => `${p.idMaquina}:${p.idProdTerm}`)).size !== pares.length) {
        throw new BadRequestException('Una máquina cambió de cliente durante el período. Divide el rango antes de facturar.');
      }
      const existente = await tx.tesoreriaFacturacionNrq.findFirst({
        where: { fechaInicio: { lte: fechaFin }, fechaFin: { gte: fechaInicio }, OR: pares },
      });
      if (existente) throw new BadRequestException('Ya existe una factura NRQ para un período que se cruza con el solicitado');
      return tx.tesoreriaFacturacionNrq.createMany({
        data: filas.map(f => ({
          idMaquina: f.ID_Maquina, idProdTerm: f.ID_Producto, idCliente: f.ID_Cliente!,
          fechaInicio, fechaFin, idUsuario, nrqInicial: f.NRQ_Inicial, nrqFinal: f.NRQ_Final,
          nrqDiferencia: f.NRQ_Diferencia, precioUnitarioVenta: f.Precio_Promedio, totalFacturar: f.total,
        })),
      });
    });
  }
}
