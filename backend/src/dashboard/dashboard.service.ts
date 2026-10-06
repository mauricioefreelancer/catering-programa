import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async gerencia() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const [totalClientes, totalProductos, totalMaquinas, pedidosMes, despachosMes, ingresosMes, efectivoMes] =
      await Promise.all([
        this.prisma.clientes.count(),
        this.prisma.productos.count(),
        this.prisma.maquinasYTiendas.count(),
        this.prisma.pedidosOperador.count({ where: { fechaHora: { gte: inicioMes, lte: finMes } } }),
        this.prisma.despachosBodega.count({ where: { fechaHora: { gte: inicioMes, lte: finMes } } }),
        this.prisma.ingresosBodega.count({ where: { fechaHora: { gte: inicioMes, lte: finMes } } }),
        this.prisma.tesoreriaEfectivoNr.aggregate({
          where: { fechaHora: { gte: inicioMes, lte: finMes } },
          _sum: { efectivoRecog: true, diferenciaRec: true },
        }),
      ]);

    const stockPorTipo = await this.prisma.$queryRaw<any[]>`
      SELECT "Tipo_Producto" as tipo, SUM("Stock_Actual") as total, COUNT(*) as productos
      FROM public."PRODUCTOS"
      GROUP BY "Tipo_Producto"
    `;

    const ventasPorClienteRaw = await this.prisma.$queryRaw<any[]>`
      SELECT c."Razon_Social" as cliente,
             COUNT(DISTINCT d."ID_Despacho") as despachos,
             SUM(d."Cant_Despachada") as unidades
      FROM public."DESPACHOS_BODEGA" d
      JOIN public."PEDIDOS_OPERADOR" p ON d."ID_Pedido" = p."ID_Pedido"
      JOIN public."MAQUINAS_Y_TIENDAS" m ON p."ID_Maquina" = m."ID_Maquina"
      JOIN public."CLIENTES" c ON m."ID_Cliente" = c."ID_Cliente"
      WHERE d."Fecha_Hora" >= ${inicioMes} AND d."Fecha_Hora" <= ${finMes}
      GROUP BY c."Razon_Social"
      ORDER BY unidades DESC
      LIMIT 10
    `;

    return {
      kpis: [
        { id: 'clientes', nombre: 'Total Clientes', valor: totalClientes, unidad: 'clientes' },
        { id: 'productos', nombre: 'Total Productos', valor: totalProductos, unidad: 'productos' },
        { id: 'maquinas', nombre: 'Total Máquinas', valor: totalMaquinas, unidad: 'máquinas' },
        { id: 'pedidos_mes', nombre: 'Pedidos del Mes', valor: pedidosMes, unidad: 'pedidos' },
        { id: 'despachos_mes', nombre: 'Despachos del Mes', valor: despachosMes, unidad: 'despachos' },
        { id: 'ingresos_mes', nombre: 'Ingresos Bodega Mes', valor: ingresosMes, unidad: 'ingresos' },
        {
          id: 'efectivo_mes',
          nombre: 'Efectivo Recaudado Mes',
          valor: Number(efectivoMes._sum.efectivoRecog || 0),
          unidad: 'COP',
        },
        {
          id: 'diferencia_mes',
          nombre: 'Diferencia Recaudos Mes',
          valor: Number(efectivoMes._sum.diferenciaRec || 0),
          unidad: 'COP',
        },
      ],
      charts: [
        { id: 'stock_por_tipo', nombre: 'Stock por Tipo Producto', tipo: 'bar', datos: stockPorTipo },
        { id: 'top_clientes', nombre: 'Top 10 Clientes por Unidades Despachadas', tipo: 'pie', datos: ventasPorClienteRaw },
      ],
    };
  }

  async tesoreria() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const [totalSaldosDigitales, saldosPorPlataforma, efectivoPorMaquina, totalFacturasNRQ] =
      await Promise.all([
        this.prisma.saldosDigitales.aggregate({
          where: { fechaTransaccion: { gte: inicioMes, lte: finMes } },
          _sum: { montoTransaccion: true },
        }),
        this.prisma.$queryRaw<any[]>`
          SELECT "Plataforma" as plataforma, SUM("Monto_Transaccion") as total, COUNT(*) as transacciones
          FROM public."SALDOS_DIGITALES"
          WHERE "Fecha_Transaccion" >= ${inicioMes} AND "Fecha_Transaccion" <= ${finMes}
          GROUP BY "Plataforma"
        `,
        this.prisma.$queryRaw<any[]>`
          SELECT m."Serial" as maquina,
                 SUM("Efectivo_Recog") as recogido,
                 SUM("Efectivo_Teorico") as teorico,
                 SUM("Diferencia_Rec") as diferencia
          FROM public."TESORERIA_EFECTIVO_NR" t
          JOIN public."MAQUINAS_Y_TIENDAS" m ON t."ID_Maquina" = m."ID_Maquina"
          WHERE t."Fecha_Hora" >= ${inicioMes} AND t."Fecha_Hora" <= ${finMes}
          GROUP BY m."Serial"
          ORDER BY recogido DESC
          LIMIT 10
        `,
        this.prisma.tesoreriaFacturacionNrq.aggregate({
          where: { fechaCreacion: { gte: inicioMes, lte: finMes } },
          _sum: { totalFacturar: true, nrqDiferencia: true },
        }),
      ]);

    return {
      kpis: [
        {
          id: 'saldos_digitales',
          nombre: 'Total Saldos Digitales Mes',
          valor: Number(totalSaldosDigitales._sum.montoTransaccion || 0),
          unidad: 'COP',
        },
        {
          id: 'total_facturar_nrq',
          nombre: 'Total a Facturar NRQ Mes',
          valor: Number(totalFacturasNRQ._sum.totalFacturar || 0),
          unidad: 'COP',
        },
        {
          id: 'total_vasos_nrq',
          nombre: 'Vasos Dispensados NRQ',
          valor: Number(totalFacturasNRQ._sum.nrqDiferencia || 0),
          unidad: 'vasos',
        },
      ],
      charts: [
        { id: 'saldos_por_plataforma', nombre: 'Saldos por Plataforma', tipo: 'pie', datos: saldosPorPlataforma },
        { id: 'efectivo_por_maquina', nombre: 'Top 10 Máquinas por Recaudo', tipo: 'bar', datos: efectivoPorMaquina },
      ],
    };
  }

  async bodega() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const [stockCritico, totalStock, ingresosBodegaMes, despachosMes, pedidosPendientes, proveedoresActivos] =
      await Promise.all([
        this.prisma.productos.count({
          where: { estado: true, AND: [{ stockActual: { lte: this.prisma.productos.fields.stockMin as any } }] },
        }),
        this.prisma.productos.aggregate({
          _sum: { stockActual: true },
        }),
        this.prisma.$queryRaw<any[]>`
          SELECT COUNT(*) as ingresos,
                 COALESCE(SUM(di."Cantidad_Recib" * di."Costo_Unitario_Compra"), 0) as valor
          FROM public."INGRESOS_BODEGA" i
          JOIN public."DETALLE_INGRESOS" di ON i."ID_Ingreso" = di."ID_Ingreso"
          WHERE i."Fecha_Hora" >= ${inicioMes} AND i."Fecha_Hora" <= ${finMes}
        `,
        this.prisma.$queryRaw<any[]>`
          SELECT COUNT(*) as despachos,
                 COALESCE(SUM(p."Cant_Sugerida"), 0) as unidades_sugeridas,
                 COALESCE(SUM(d."Cant_Despachada"), 0) as unidades_despachadas
          FROM public."DESPACHOS_BODEGA" d
          JOIN public."PEDIDOS_OPERADOR" p ON d."ID_Pedido" = p."ID_Pedido"
          WHERE d."Fecha_Hora" >= ${inicioMes} AND d."Fecha_Hora" <= ${finMes}
        `,
        this.prisma.pedidosOperador.count({
          where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        }),
        this.prisma.proveedores.count({ where: { estado: true } }),
      ]);

    const stockPorProducto = await this.prisma.$queryRaw<any[]>`
      SELECT "Nombre_Producto" as nombre, "Stock_Actual" as stock, "Stock_Min" as minimo, "Stock_Max" as maximo
      FROM public."PRODUCTOS"
      WHERE "Estado" = TRUE
      ORDER BY "Stock_Actual" ASC
      LIMIT 20
    `;

    const movimientosPorSemana = await this.prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(fecha, 'IYYY-IW') as semana,
        SUM(CASE WHEN tipo = 'INGRESO' THEN cant ELSE 0 END) as ingresos,
        SUM(CASE WHEN tipo = 'DESPACHO' THEN cant ELSE 0 END) as despachos
      FROM (
        SELECT DATE(i."Fecha_Hora") as fecha, SUM(di."Cantidad_Recib") as cant, 'INGRESO'::text as tipo
        FROM public."INGRESOS_BODEGA" i
        JOIN public."DETALLE_INGRESOS" di ON i."ID_Ingreso" = di."ID_Ingreso"
        WHERE i."Fecha_Hora" >= ${inicioMes} AND i."Fecha_Hora" <= ${finMes}
        GROUP BY DATE(i."Fecha_Hora")
        UNION ALL
        SELECT DATE(d."Fecha_Hora") as fecha, SUM(d."Cant_Despachada") as cant, 'DESPACHO'::text as tipo
        FROM public."DESPACHOS_BODEGA" d
        WHERE d."Fecha_Hora" >= ${inicioMes} AND d."Fecha_Hora" <= ${finMes}
        GROUP BY DATE(d."Fecha_Hora")
      ) x
      GROUP BY TO_CHAR(fecha, 'IYYY-IW')
      ORDER BY semana
    `;

    const ingresosData: any = (ingresosBodegaMes as any)[0] || { ingresos: 0, valor: 0 };
    const despachosData: any = (despachosMes as any)[0] || {
      despachos: 0,
      unidades_sugeridas: 0,
      unidades_despachadas: 0,
    };

    return {
      kpis: [
        { id: 'stock_critico', nombre: 'Productos con Stock Crítico', valor: stockCritico, unidad: 'productos' },
        { id: 'total_stock', nombre: 'Stock Total Actual', valor: Number(totalStock._sum.stockActual || 0), unidad: 'unidades' },
        { id: 'ingresos_mes_cant', nombre: 'Ingresos Bodega Mes', valor: Number(ingresosData.ingresos || 0), unidad: 'ingresos' },
        { id: 'ingresos_mes_valor', nombre: 'Valor Ingresos Mes', valor: Number(ingresosData.valor || 0), unidad: 'COP' },
        { id: 'despachos_mes_cant', nombre: 'Despachos Mes', valor: Number(despachosData.despachos || 0), unidad: 'despachos' },
        { id: 'despachos_mes_unidades', nombre: 'Unidades Despachadas', valor: Number(despachosData.unidades_despachadas || 0), unidad: 'unidades' },
        { id: 'pedidos_pendientes', nombre: 'Pedidos Pendientes', valor: pedidosPendientes, unidad: 'pedidos' },
        { id: 'proveedores_activos', nombre: 'Proveedores Activos', valor: proveedoresActivos, unidad: 'proveedores' },
      ],
      charts: [
        { id: 'stock_top20_bajo', nombre: 'Top 20 Productos con Menor Stock', tipo: 'bar', datos: stockPorProducto },
        { id: 'movimientos_semana', nombre: 'Ingresos vs Despachos por Semana', tipo: 'line', datos: movimientosPorSemana },
      ],
    };
  }

  // ============================================================
  // HISTORIAL DE DISPOSITIVOS POR MÁQUINA (línea de tiempo de seriales)
  // Reconstruye, para cada máquina y medio de pago, los intervalos de tiempo
  // [desde, hasta] durante los cuales estuvo instalado cada serial (dispositivo).
  // Es útil para saber por fechas cuándo entró/salió un serial, incluidos los
  // cambios provisionales (reparación) o definitivos.
  // Adicionalmente expone el usuario que hizo cada asignación/cambio y el evento
  // asociado, cruzado con el log de auditoría.
  // GET /dashboard/dispositivos?fechaDesde=&fechaHasta=&maquinaId=&tipoMedio=
  // ============================================================
  async dispositivos(query: { fechaDesde?: string; fechaHasta?: string; maquinaId?: string; tipoMedio?: string }) {
    const where: any = {};
    if (query.maquinaId) {
      const mid = parseInt(query.maquinaId);
      if (!isNaN(mid)) where.idMaquina = mid;
    }
    if (query.tipoMedio) where.tipoMedio = query.tipoMedio.toUpperCase();
    if (query.fechaDesde) {
      const d = new Date(query.fechaDesde);
      if (!isNaN(d.getTime())) where.fechaCambio = { ...(where.fechaCambio ?? {}), gte: d };
    }
    if (query.fechaHasta) {
      const d = new Date(query.fechaHasta);
      if (!isNaN(d.getTime())) where.fechaCambio = { ...(where.fechaCambio ?? {}), lte: d };
    }

    const registros = await this.prisma.historialMediosPago.findMany({
      where,
      include: { usuario: { select: { idUsuario: true, nombreCompleto: true, usuarioLogin: true } } },
      orderBy: [{ idMaquina: 'asc' }, { tipoMedio: 'asc' }, { fechaCambio: 'asc' }],
    });

    // Agrupar cronológicamente por (máquina, medio) para reconstruir la vigencia
    // de cada serial (dispositivo) a lo largo del tiempo.
    const grupos = new Map<string, any[]>();
    for (const r of registros) {
      const clave = `${r.idMaquina}|${r.tipoMedio}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(r);
    }

    const intervalos: any[] = [];
    const serialesPorMaquina = new Map<number, { serial: string; marca?: string; clienteNombre?: string }>();
    const maquinaIds = Array.from(new Set(registros.map((r) => r.idMaquina)));
    if (maquinaIds.length) {
      const maquinas = await this.prisma.maquinasYTiendas.findMany({
        where: { idMaquina: { in: maquinaIds } },
        select: { idMaquina: true, serial: true, marca: true, cliente: { select: { razonSocial: true } } },
      });
      for (const m of maquinas) {
        serialesPorMaquina.set(m.idMaquina, { serial: m.serial, marca: (m as any).marca, clienteNombre: (m as any).cliente?.razonSocial });
      }
    }

    for (const [clave, lista] of grupos) {
      const [idMaquina, tipoMedio] = clave.split('|');
      const mid = Number(idMaquina);
      // Sobre cada registro con serial, calcular cuánto tiempo estuvo vigente ese
      // serial tomando como "hasta" la fecha del siguiente registro que reemplace
      // el estado del dispositivo (QUITAR_SERIAL/INACTIVAR/CAMBIAR_SERIAL/...).
      for (let i = 0; i < lista.length; i++) {
        const r = lista[i];
        const serial = r.serialDispositivo;
        if (!serial) continue;
        // "hasta" = fecha del siguiente evento, si lo hay; si no, sigue vigente (hasta hoy).
        const siguiente = lista[i + 1];
        const hasta = siguiente ? siguiente.fechaCambio : null;
        const infoMaquina = serialesPorMaquina.get(mid);
        intervalos.push({
          idMaquina: mid,
          serialMaquina: infoMaquina?.serial ?? r.serialMaquina ?? null,
          marca: infoMaquina?.marca ?? null,
          cliente: infoMaquina?.clienteNombre ?? null,
          tipoMedio,
          serialDispositivo: serial,
          desde: r.fechaCambio,
          hasta,
          vigente: !hasta,
          accion: r.accion,
          valorAnterior: r.valorAnterior,
          valorNuevo: r.valorNuevo,
          idUsuario: r.idUsuario,
          usuario: r.usuario ? `${r.usuario.nombreCompleto} (${r.usuario.usuarioLogin})` : null,
        });
      }
    }

    // Los eventos que no aportan intervalo (composición inicial) se listan aparte.
    const sinSerial = registros.filter((r) => !r.serialDispositivo && r.tipoMedio === 'COMPOSICION');

    return {
      kpis: [
        { id: 'total_intervalos', nombre: 'Asignaciones Registradas', valor: intervalos.length, unidad: 'registros' },
        { id: 'dispositivos_reemplazados', nombre: 'Seriales Reemplazados', valor: intervalos.filter((i) => i.accion === 'CAMBIAR_SERIAL' || i.accion === 'QUITAR_SERIAL').length, unidad: 'dispositivos' },
        { id: 'marcas_activas', nombre: 'Máquinas con Historial', valor: serialesPorMaquina.size, unidad: 'máquinas' },
        { id: 'cambios_provisionales', nombre: 'Cambios Activo/Inactivo', valor: intervalos.filter((i) => i.accion === 'ACTIVAR' || i.accion === 'INACTIVAR').length, unidad: 'eventos' },
      ],
      intervalos,
      eventosSinSerial: sinSerial,
    };
  }

  // ============================================================
  // INGRESOS A BODEGA (entradas de inventario)
  // Consulta los ingresos a bodega por rango de fechas y, opcionalmente,
  // por usuario que los registró, con los datos de la factura, proveedor,
  // producto, cantidad y costo unitario, además de la auditoría del usuario.
  // GET /dashboard/ingresos-bodega?fechaDesde=&fechaHasta=&usuarioId=
  // ============================================================
  async ingresosBodega(query: { fechaDesde?: string; fechaHasta?: string; usuarioId?: string }) {
    const where: any = {};
    if (query.fechaDesde) {
      const d = new Date(query.fechaDesde);
      if (!isNaN(d.getTime())) where.fechaHora = { ...(where.fechaHora ?? {}), gte: d };
    }
    if (query.fechaHasta) {
      const d = new Date(query.fechaHasta);
      if (!isNaN(d.getTime())) where.fechaHora = { ...(where.fechaHora ?? {}), lte: d };
    }
    if (query.usuarioId) {
      const uid = parseInt(query.usuarioId);
      if (!isNaN(uid)) where.idUsuario = uid;
    }

    const ingresos = await this.prisma.ingresosBodega.findMany({
      where,
      include: {
        proveedor: { select: { razonSocial: true } },
        usuario: { select: { idUsuario: true, nombreCompleto: true, usuarioLogin: true } },
        detalleIngresos: {
          include: { producto: { select: { nombreProducto: true } } },
        },
      },
      orderBy: { fechaHora: 'desc' },
    });

    // KPIs acumulados sobre el detalle de los ingresos.
    let totalUnidades = 0;
    let totalValor = 0;
    for (const ing of ingresos) {
      for (const d of ing.detalleIngresos) {
        totalUnidades += d.cantidadRecib || 0;
        totalValor += Number(d.costoUnitarioCompra || 0) * (d.cantidadRecib || 0);
      }
    }

    const filas = ingresos.map((ing) => ({
      idIngreso: ing.idIngreso,
      factura: ing.facturaNum,
      fecha: ing.fechaHora,
      proveedor: ing.proveedor?.razonSocial ?? null,
      observaciones: ing.observaciones,
      idUsuario: ing.idUsuario,
      usuario: ing.usuario ? `${ing.usuario.nombreCompleto}` : null,
      login: ing.usuario ? ing.usuario.usuarioLogin : null,
      detalle: ing.detalleIngresos.map((d) => ({
        idDetIngreso: d.idDetIngreso,
        idProducto: d.idProducto,
        producto: d.producto?.nombreProducto ?? null,
        cantidad: d.cantidadRecib,
        costoUnitario: Number(d.costoUnitarioCompra),
        costoTotal: Number(d.costoUnitarioCompra) * (d.cantidadRecib || 0),
      })),
    }));

    return {
      kpis: [
        { id: 'ing_bodega_total', nombre: 'Ingresos Realizados', valor: ingresos.length, unidad: 'ingresos' },
        { id: 'ing_bodega_unidades', nombre: 'Unidades Recibidas', valor: totalUnidades, unidad: 'unidades' },
        { id: 'ing_bodega_valor', nombre: 'Valor Total Ingresado', valor: totalValor, unidad: 'COP' },
        { id: 'ing_bodega_usuarios', nombre: 'Usuarios que Ingresaron', valor: new Set(ingresos.map((i) => i.idUsuario)).size, unidad: 'usuarios' },
      ],
      ingresos: filas,
      usuarios: await this.usuariosConIngresos(),
    };
  }

  // Lista de usuarios activos para el filtro del dashboard.
  private async usuariosConIngresos() {
    const usuarios = await this.prisma.usuariosSistema.findMany({
      where: { estado: true },
      select: { idUsuario: true, nombreCompleto: true, usuarioLogin: true },
      orderBy: { nombreCompleto: 'asc' },
    });
    return usuarios.map((u) => ({ id: u.idUsuario, nombre: u.nombreCompleto, login: u.usuarioLogin }));
  }
}
