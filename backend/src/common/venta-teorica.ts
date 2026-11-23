import { Prisma } from '@prisma/client';

export type LineaVenta = {
  unidades: number | bigint | null;
  precio: Prisma.Decimal | null;
  porcentajeCliente: Prisma.Decimal;
};

export function calcularVentaTeorica(ventaNr: bigint, lineas: LineaVenta[]) {
  let ventaTeorica = new Prisma.Decimal(0);
  let valorFacturarCliente = new Prisma.Decimal(0);
  let completa = lineas.length > 0;
  const controles = lineas.map(({ unidades, precio, porcentajeCliente }) => {
    const inconsistencia = unidades == null ? 'SIN_BASE_COMPARABLE'
      : unidades < 0 ? 'UNIDADES_NEGATIVAS'
        : precio == null ? 'SIN_PRECIO_CLIENTE' : null;
    if (inconsistencia || unidades == null || precio == null) {
      completa = false;
      return { inconsistencia, subtotal: null, cobrado: null, facturable: null };
    }
    const subtotal = precio.mul(unidades.toString());
    const facturable = subtotal.mul(porcentajeCliente).div(100);
    const cobrado = subtotal.minus(facturable);
    valorFacturarCliente = valorFacturarCliente.plus(facturable);
    ventaTeorica = ventaTeorica.plus(cobrado);
    return { inconsistencia, subtotal, cobrado, facturable };
  });
  return {
    controles,
    ventaTeorica,
    valorFacturarCliente,
    diferenciaVenta: completa ? new Prisma.Decimal(ventaNr.toString()).minus(ventaTeorica) : null,
  };
}
