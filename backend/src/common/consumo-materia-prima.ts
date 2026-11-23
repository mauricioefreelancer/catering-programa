import { Prisma } from '@prisma/client';

type Dosis = { unidades: bigint | null; cantidadDosis: Prisma.Decimal };
type Tolva = { fisicoAnterior: number | null; despachado: number; fisicoActual: number };

export function calcularConsumoMateriaPrima(
  dosis: Dosis[], tolvas: Tolva[], equivalencia: Prisma.Decimal, costoBase: Prisma.Decimal,
) {
  const cero = new Prisma.Decimal(0);
  const consumoTeorico = dosis.some(d => d.unidades == null) ? null
    : dosis.reduce((total, d) => total.plus(d.cantidadDosis.mul(d.unidades!.toString())), cero);
  const consumoReal = equivalencia.lte(0) || !tolvas.length || tolvas.some(t => t.fisicoAnterior == null) ? null
    : equivalencia.mul(tolvas.reduce((total, t) => total + t.fisicoAnterior! + t.despachado - t.fisicoActual, 0));
  const diferencia = consumoReal != null && consumoTeorico != null ? consumoReal.minus(consumoTeorico) : null;
  return {
    consumoTeorico, consumoReal, diferencia,
    valorDiferencia: diferencia?.abs().mul(costoBase).div(equivalencia) ?? null,
    inconsistencia: equivalencia.lte(0) ? 'EQUIVALENCIA_INVALIDA' : !tolvas.length ? 'SIN_TOLVA_CONFIGURADA'
      : consumoReal == null ? 'SIN_FISICO_ANTERIOR' : consumoTeorico == null ? 'SIN_LECTURA_NRQ' : null,
  };
}
