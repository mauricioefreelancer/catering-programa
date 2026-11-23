import { Prisma } from '@prisma/client';
import { mesColombia } from './fecha-colombia';

const DIA_MS = 86_400_000;
const CINCO_HORAS_MS = 5 * 60 * 60 * 1000;

export type MotivoAvisoFacturacion =
  | 'SIN_CORTE_DEL_MES'
  | 'SIN_CORTE_ANTERIOR'
  | 'PERIODO_EXTENDIDO'
  | 'INICIO_POSTERIOR_AL_CORTE';

export type TipoFacturacion = 'NRQ_CAFE' | 'SUBSIDIO_TOTAL' | 'SUBSIDIO_PARCIAL';
export const TIPOS_FACTURACION: TipoFacturacion[] = ['NRQ_CAFE', 'SUBSIDIO_TOTAL', 'SUBSIDIO_PARCIAL'];

/** Fecha calendario (medianoche UTC, como la guarda una columna DATE) del día en Bogotá de un instante. */
export function diaColombia(instante: Date) {
  const local = new Date(instante.getTime() - CINCO_HORAS_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Normaliza una fecha calendario (columna DATE) a medianoche UTC. */
export function fechaCalendario(fecha: Date) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/** Instante en que empieza en Bogotá una fecha calendario. */
export function inicioDiaColombia(fecha: Date) {
  return new Date(fechaCalendario(fecha).getTime() + CINCO_HORAS_MS);
}

export function sumarDias(fecha: Date, dias: number) {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

export type PeriodoFacturacion = {
  /** Primer día facturable (fecha calendario, inclusive). */
  fechaInicio: Date;
  /** Día del corte que cierra el período (fecha calendario, inclusive). */
  fechaFin: Date;
};

export type ResultadoPeriodo = {
  periodo: PeriodoFacturacion | null;
  aviso: { motivo: MotivoAvisoFacturacion; fechaInicio?: Date } | null;
};

/**
 * Calcula el período de facturación al cliente de una máquina para el mes consultado.
 *
 * - Cierra en el último corte del mes consultado (sin corte: SIN_CORTE_DEL_MES).
 * - Empieza el día siguiente al último corte anterior al mes, sin importar en qué mes
 *   fue. Si ese corte es más antiguo que el mes anterior se avisa PERIODO_EXTENDIDO.
 * - Sin corte anterior empieza en la fecha de inicio de facturación de la máquina; sin
 *   fecha ni corte se avisa SIN_CORTE_ANTERIOR.
 * - Nunca empieza antes de la fecha de inicio de facturación.
 */
export function periodoFacturacion(p: {
  inicioMes: Date;
  corteActual: Date | null;
  corteAnterior: Date | null;
  fechaInicioFacturacion: Date | null;
}): ResultadoPeriodo {
  if (!p.corteActual) return { periodo: null, aviso: { motivo: 'SIN_CORTE_DEL_MES' } };
  const fechaFin = diaColombia(p.corteActual);
  const inicioMesAnterior = mesColombia(new Date(p.inicioMes.getTime() - 1)).inicio;

  const desdeCorte = p.corteAnterior ? sumarDias(diaColombia(p.corteAnterior), 1) : null;
  const desdeFecha = p.fechaInicioFacturacion ? fechaCalendario(p.fechaInicioFacturacion) : null;
  if (!desdeCorte && !desdeFecha) return { periodo: null, aviso: { motivo: 'SIN_CORTE_ANTERIOR' } };

  const usaFecha = desdeFecha != null && (desdeCorte == null || desdeFecha > desdeCorte);
  const fechaInicio = usaFecha ? desdeFecha! : desdeCorte!;
  if (fechaInicio > fechaFin) {
    return { periodo: null, aviso: { motivo: 'INICIO_POSTERIOR_AL_CORTE', fechaInicio } };
  }
  const extendido = usaFecha
    ? fechaInicio < diaColombia(inicioMesAnterior)
    : p.corteAnterior!.getTime() < inicioMesAnterior.getTime();
  return {
    periodo: { fechaInicio, fechaFin },
    aviso: extendido ? { motivo: 'PERIODO_EXTENDIDO', fechaInicio } : null,
  };
}

export function tipoLectura(l: { idMapaMp: number | null; porcentajeCliente: Prisma.Decimal | null }): TipoFacturacion {
  return l.idMapaMp == null ? 'NRQ_CAFE' : l.porcentajeCliente?.eq(100) ? 'SUBSIDIO_TOTAL' : 'SUBSIDIO_PARCIAL';
}

export const claveFactura = (idProdTerm: number, tipo: string) => `${idProdTerm}:${tipo}`;

/**
 * Última Fecha_Fin facturada por producto y tipo. Las facturas antiguas sin porcentaje
 * (anteriores a los tipos) bloquean todos los tipos del producto.
 */
export function ultimasFechasFacturadas(facturas: {
  idProdTerm: number; tipo: string; porcentajeCliente: unknown; fechaFin: Date;
}[]) {
  const ultimas = new Map<string, Date>();
  for (const f of facturas) {
    const tipos = f.porcentajeCliente == null ? TIPOS_FACTURACION : [f.tipo];
    for (const tipo of tipos) {
      const clave = claveFactura(f.idProdTerm, tipo);
      const fin = fechaCalendario(f.fechaFin);
      const previa = ultimas.get(clave);
      if (!previa || fin > previa) ultimas.set(clave, fin);
    }
  }
  return ultimas;
}

/** Primer día facturable de un producto y tipo: nunca antes del día siguiente a su última factura. */
export function inicioFacturable(fechaInicioPeriodo: Date, ultimaFin?: Date) {
  const tras = ultimaFin ? sumarDias(fechaCalendario(ultimaFin), 1) : null;
  return tras && tras > fechaInicioPeriodo ? tras : fechaInicioPeriodo;
}

/** Descarta las lecturas que ya quedaron dentro de una factura anterior del mismo producto y tipo. */
export function lecturasNoFacturadas<L extends {
  idProdTerm: number; idMapaMp: number | null; porcentajeCliente: Prisma.Decimal | null;
  visita: { fechaVisita: Date };
}>(lecturas: L[], fechaInicioPeriodo: Date, ultimas: Map<string, Date>) {
  return lecturas.filter(l => {
    const inicio = inicioFacturable(fechaInicioPeriodo, ultimas.get(claveFactura(l.idProdTerm, tipoLectura(l))));
    return l.visita.fechaVisita.getTime() >= inicioDiaColombia(inicio).getTime();
  });
}
