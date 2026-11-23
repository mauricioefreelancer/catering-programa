import { Prisma } from '@prisma/client';
import { mesColombia } from './fecha-colombia';
import {
  diaColombia, lecturasNoFacturadas, periodoFacturacion, ultimasFechasFacturadas,
} from './periodo-facturacion';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Instante a una hora local de Bogotá (UTC-5). */
const bogota = (iso: string, hora = 10) => new Date(Date.UTC(
  Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hora + 5));
const inicioMes = (iso: string) => mesColombia(bogota(iso)).inicio;
const texto = (d?: Date) => d?.toISOString().slice(0, 10);

describe('Período de facturación al cliente', () => {
  it('usa la fecha del día en Bogotá aunque en UTC ya sea el día siguiente', () => {
    expect(texto(diaColombia(bogota('2026-03-31', 22)))).toBe('2026-03-31');
  });

  it('factura el primer mes desde la fecha de inicio de facturación', () => {
    const r = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-30'),
      corteAnterior: null, fechaInicioFacturacion: dia('2026-03-10'),
    });
    expect(r.aviso).toBeNull();
    expect(texto(r.periodo?.fechaInicio)).toBe('2026-03-10');
    expect(texto(r.periodo?.fechaFin)).toBe('2026-03-30');
  });

  it('avisa SIN_CORTE_ANTERIOR si no hay corte previo ni fecha de inicio', () => {
    const r = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-30'),
      corteAnterior: null, fechaInicioFacturacion: null,
    });
    expect(r.periodo).toBeNull();
    expect(r.aviso?.motivo).toBe('SIN_CORTE_ANTERIOR');
  });

  it('un mes sin corte no se factura y el siguiente cubre ambos meses con PERIODO_EXTENDIDO', () => {
    const corteEnero = bogota('2026-01-30');
    const febrero = periodoFacturacion({
      inicioMes: inicioMes('2026-02-01'), corteActual: null,
      corteAnterior: corteEnero, fechaInicioFacturacion: null,
    });
    expect(febrero.periodo).toBeNull();
    expect(febrero.aviso?.motivo).toBe('SIN_CORTE_DEL_MES');

    const marzo = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-29'),
      corteAnterior: corteEnero, fechaInicioFacturacion: null,
    });
    expect(texto(marzo.periodo?.fechaInicio)).toBe('2026-01-31');
    expect(texto(marzo.periodo?.fechaFin)).toBe('2026-03-29');
    expect(marzo.aviso?.motivo).toBe('PERIODO_EXTENDIDO');
    expect(texto(marzo.aviso?.fechaInicio)).toBe('2026-01-31');
  });

  it('un corte en el mes anterior es un período normal, sin aviso', () => {
    const r = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-28'),
      corteAnterior: bogota('2026-02-01', 8), fechaInicioFacturacion: null,
    });
    expect(r.aviso).toBeNull();
    expect(texto(r.periodo?.fechaInicio)).toBe('2026-02-02');
  });

  it('nunca empieza antes de la fecha de inicio de facturación', () => {
    const r = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-28'),
      corteAnterior: bogota('2025-11-30'), fechaInicioFacturacion: dia('2026-02-15'),
    });
    expect(texto(r.periodo?.fechaInicio)).toBe('2026-02-15');
    expect(r.aviso).toBeNull();
  });

  it('avisa si la fecha de inicio es posterior al corte del mes', () => {
    const r = periodoFacturacion({
      inicioMes: inicioMes('2026-03-01'), corteActual: bogota('2026-03-05'),
      corteAnterior: null, fechaInicioFacturacion: dia('2026-03-20'),
    });
    expect(r.periodo).toBeNull();
    expect(r.aviso?.motivo).toBe('INICIO_POSTERIOR_AL_CORTE');
  });
});

describe('Sin doble facturación', () => {
  const dec = (v: number) => new Prisma.Decimal(v);
  const lectura = (fecha: Date, extra: Partial<{ idMapaMp: number | null; porcentajeCliente: Prisma.Decimal; idProdTerm: number }> = {}) => ({
    idProdTerm: 8, idMapaMp: 5 as number | null, porcentajeCliente: dec(40), visita: { fechaVisita: fecha }, ...extra,
  });

  it('descarta las lecturas hasta la Fecha_Fin de la última factura del mismo producto y tipo', () => {
    const ultimas = ultimasFechasFacturadas([
      { idProdTerm: 8, tipo: 'SUBSIDIO_PARCIAL', porcentajeCliente: dec(40), fechaFin: dia('2026-02-10') },
      { idProdTerm: 8, tipo: 'SUBSIDIO_PARCIAL', porcentajeCliente: dec(40), fechaFin: dia('2026-01-31') },
    ]);
    const lecturas = [
      lectura(bogota('2026-02-10', 23)),
      lectura(bogota('2026-02-11', 0)),
      lectura(bogota('2026-02-05'), { porcentajeCliente: dec(100) }),
    ];
    const vigentes = lecturasNoFacturadas(lecturas, dia('2026-02-01'), ultimas);
    expect(vigentes).toEqual([lecturas[1], lecturas[2]]);
  });

  it('una factura antigua sin porcentaje bloquea todos los tipos del producto', () => {
    const ultimas = ultimasFechasFacturadas([
      { idProdTerm: 8, tipo: 'NRQ_CAFE', porcentajeCliente: null, fechaFin: dia('2026-02-28') },
    ]);
    const lecturas = [
      lectura(bogota('2026-02-20')),
      lectura(bogota('2026-02-20'), { idMapaMp: null }),
      lectura(bogota('2026-02-20'), { idProdTerm: 9 }),
    ];
    expect(lecturasNoFacturadas(lecturas, dia('2026-02-01'), ultimas)).toEqual([lecturas[2]]);
  });

  it('el período siguiente a una factura no vuelve a tomar sus lecturas', () => {
    const corteEnero = bogota('2026-01-30');
    const enero = periodoFacturacion({
      inicioMes: inicioMes('2026-01-01'), corteActual: corteEnero,
      corteAnterior: bogota('2025-12-30'), fechaInicioFacturacion: null,
    });
    const ultimas = ultimasFechasFacturadas([
      { idProdTerm: 8, tipo: 'SUBSIDIO_PARCIAL', porcentajeCliente: dec(40), fechaFin: enero.periodo!.fechaFin },
    ]);
    const febrero = periodoFacturacion({
      inicioMes: inicioMes('2026-02-01'), corteActual: bogota('2026-02-27'),
      corteAnterior: corteEnero, fechaInicioFacturacion: null,
    });
    const lecturas = [lectura(corteEnero), lectura(bogota('2026-02-15'))];
    expect(lecturasNoFacturadas(lecturas, febrero.periodo!.fechaInicio, ultimas)).toEqual([lecturas[1]]);
  });
});
