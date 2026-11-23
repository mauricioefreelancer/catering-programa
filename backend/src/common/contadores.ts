export function diferenciaContador(anterior: bigint, actual: bigint, reinicio = false): bigint {
  if (actual < 0n || (!reinicio && actual < anterior)) {
    throw new RangeError('La lectura es inferior a la anterior sin reinicio confirmado');
  }
  return reinicio ? actual : actual - anterior;
}

export function vendidasPorEspiral(fisicoAnterior: number, despachado: number, fisicoActual: number) {
  return fisicoAnterior + despachado - fisicoActual;
}

export function umbralDiferenciaVenta(raw: string | undefined) {
  const valor = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(valor) && valor >= 0 ? valor : 10_000;
}
