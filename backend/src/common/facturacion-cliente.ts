import { Prisma } from '@prisma/client';
import { tipoLectura } from './periodo-facturacion';

type Lectura = {
  idMapaMp: number | null; idMapaNrq: number | null; idProdTerm: number;
  lecturaAnterior: bigint; lecturaActual: bigint; unidades: bigint;
  precioUnitario: Prisma.Decimal | null; porcentajeCliente: Prisma.Decimal | null;
  visita: { idCliente: number | null; cliente: { razonSocial: string } | null };
  producto: { nombreProducto: string };
};

export function agruparFacturacionCliente(idMaquina: number, serial: string, lecturas: Lectura[]) {
  const cero = new Prisma.Decimal(0);
  const filas = new Map<string, {
    ID_Maquina: number; Serial: string; ID_Cliente: number | null; Razon_Social: string | null;
    ID_Producto: number; Nombre_Producto: string; tipo: string; incompleta: boolean;
    unidades: bigint; valorVentaTotal: Prisma.Decimal; total: Prisma.Decimal;
    mapas: Map<string, { inicial: bigint; final: bigint; idMapaMp: number | null }>;
  }>();
  for (const l of lecturas) {
    if (!l.porcentajeCliente?.gt(0) || l.unidades <= 0n || (l.idMapaMp == null && l.idMapaNrq == null)) continue;
    const tipo = tipoLectura(l);
    const llave = `${l.visita.idCliente}:${l.idProdTerm}:${tipo}`;
    const fila = filas.get(llave) ?? {
      ID_Maquina: idMaquina, Serial: serial, ID_Cliente: l.visita.idCliente, Razon_Social: l.visita.cliente?.razonSocial ?? null,
      ID_Producto: l.idProdTerm, Nombre_Producto: l.producto.nombreProducto, tipo, incompleta: false,
      unidades: 0n, valorVentaTotal: cero, total: cero, mapas: new Map(),
    };
    const subtotal = l.precioUnitario?.mul(l.unidades.toString());
    fila.incompleta ||= subtotal == null || l.visita.idCliente == null;
    fila.unidades += l.unidades;
    if (subtotal != null) {
      fila.valorVentaTotal = fila.valorVentaTotal.plus(subtotal);
      fila.total = fila.total.plus(subtotal.mul(l.porcentajeCliente).div(100));
    }
    const claveMapa = `${l.idMapaMp}:${l.idMapaNrq}`;
    const anterior = fila.mapas.get(claveMapa);
    fila.mapas.set(claveMapa, { idMapaMp: l.idMapaMp, inicial: anterior?.inicial ?? l.lecturaAnterior, final: l.lecturaActual });
    filas.set(llave, fila);
  }
  return [...filas.values()].map(({ mapas, unidades, ...fila }) => {
    const origenes = [...mapas.values()];
    return {
      ...fila, total: fila.total.toDecimalPlaces(2), NRQ_Diferencia: unidades,
      NRQ_Inicial: origenes.reduce((total, l) => total + l.inicial, 0n),
      NRQ_Final: origenes.reduce((total, l) => total + l.final, 0n),
      idMapaMp: origenes.length === 1 ? origenes[0].idMapaMp : null,
      Precio_Promedio: fila.valorVentaTotal.div(unidades.toString()).toDecimalPlaces(2),
      porcentajeCliente: fila.valorVentaTotal.gt(0) ? fila.total.div(fila.valorVentaTotal).mul(100).toDecimalPlaces(2) : null,
    };
  });
}
