import { BadRequestException } from '@nestjs/common';

const DIA_MS = 86_400_000;

function fechaUtc(fecha: string) {
  const valor = new Date(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(valor.getTime()) ||
      valor.toISOString().slice(0, 10) !== fecha) {
    throw new BadRequestException('Las fechas deben tener formato AAAA-MM-DD');
  }
  return valor;
}

export function rangoColombia(inicio?: string, fin?: string) {
  const fechaInicio = inicio == null ? undefined : fechaUtc(inicio);
  const fechaFin = fin == null ? undefined : fechaUtc(fin);
  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
  }
  const cincoHoras = 5 * 60 * 60 * 1000;
  return {
    fechaInicio,
    fechaFin,
    desde: fechaInicio && new Date(fechaInicio.getTime() + cincoHoras),
    hasta: fechaFin && new Date(fechaFin.getTime() + cincoHoras + DIA_MS),
  };
}

export function mesColombia(ahora = new Date()) {
  const local = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);
  const inicio = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 5));
  const fin = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1, 5));
  return { inicio, fin };
}
