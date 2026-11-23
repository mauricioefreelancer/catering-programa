import { Prisma } from '@prisma/client';
import { costoDosis } from './costo-receta';
import { mesColombia, rangoColombia } from './fecha-colombia';

describe('Fechas de negocio de Colombia', () => {
  it('incluye todo el dia final con un limite exclusivo a medianoche', () => {
    const rango = rangoColombia('2026-11-24', '2026-11-24');
    expect(rango.desde?.toISOString()).toBe('2026-11-24T05:00:00.000Z');
    expect(rango.hasta?.toISOString()).toBe('2026-11-25T05:00:00.000Z');
  });

  it('conserva el mes anterior hasta la medianoche de Colombia', () => {
    const mes = mesColombia(new Date('2026-12-01T04:59:59Z'));
    expect(mes.inicio.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(mes.fin.toISOString()).toBe('2026-12-01T05:00:00.000Z');
  });

  it('rechaza fechas imposibles y rangos invertidos', () => {
    expect(() => rangoColombia('2026-02-30')).toThrow();
    expect(() => rangoColombia('2026-03-02', '2026-03-01')).toThrow();
  });
});

describe('Costo de receta', () => {
  it('prorratea el precio del empaque por la dosis', () => {
    expect(costoDosis(new Prisma.Decimal(8), new Prisma.Decimal(12000), new Prisma.Decimal(500)).toNumber()).toBe(192);
  });

  it('rechaza equivalencia cero', () => {
    expect(() => costoDosis(new Prisma.Decimal(1), new Prisma.Decimal(100), new Prisma.Decimal(0))).toThrow();
  });
});
