import { Prisma } from '@prisma/client';

export function diferenciaContador(anterior: bigint, actual: bigint, reinicio = false): bigint {
  if (actual < 0n || (!reinicio && actual < anterior)) {
    throw new RangeError('La lectura es inferior a la anterior sin reinicio confirmado');
  }
  return reinicio ? actual : actual - anterior;
}

export function vendidasPorEspiral(fisicoAnterior: number, despachado: number, fisicoActual: number) {
  return fisicoAnterior + despachado - fisicoActual;
}

export function sugeridoMateriaPrima(consumo: Prisma.Decimal, equivalencia: Prisma.Decimal, capacidad: number) {
  if (equivalencia.lte(0)) throw new RangeError('La equivalencia debe ser mayor que cero');
  return Prisma.Decimal.min(capacidad, consumo.div(equivalencia).ceil()).toNumber();
}

export function umbralDiferenciaVenta(raw: string | undefined) {
  const valor = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(valor) && valor >= 0 ? valor : 10_000;
}
