export enum EstadoPedido {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  REEMPLAZADO = 'REEMPLAZADO',
  NO_REPONER = 'NO_REPONER',
}

export const PEDIDOS_ABIERTOS = [EstadoPedido.PENDIENTE, EstadoPedido.PARCIAL];

export function sugeridoPorEspiral(capacidad: number, fisico: number): number {
  if (!Number.isInteger(fisico) || fisico < 0 || fisico > capacidad) {
    throw new RangeError(`El físico debe estar entre 0 y ${capacidad}`);
  }
  return capacidad - fisico;
}

export function pendientePedido(sugerido: number, despachado: number): number {
  return Math.max(0, sugerido - despachado);
}

export function calcularDespacho(p: {
  sugerido: number;
  acumulado: number;
  capacidad: number;
  fisico: number;
  stock: number;
  solicitado?: number;
  noReponer?: boolean;
}) {
  const pendienteAntes = pendientePedido(p.sugerido, p.acumulado);
  const cupo = Math.max(0, p.capacidad - p.fisico - p.acumulado);
  const cantidad = p.noReponer
    ? 0
    : Math.max(0, Math.min(p.solicitado ?? pendienteAntes, pendienteAntes, p.stock, cupo));
  const pendiente = pendienteAntes - cantidad;
  const estado = p.noReponer
    ? EstadoPedido.NO_REPONER
    : pendiente === 0 ? EstadoPedido.APROBADO : EstadoPedido.PARCIAL;
  return { cantidad, pendiente, estado };
}
