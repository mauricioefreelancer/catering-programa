import { Prisma } from '@prisma/client';
import { calcularVentaTeorica } from './venta-teorica';

const d = (value: number) => new Prisma.Decimal(value);

describe('Venta teorica de espirales y cafe', () => {
  it('reparte $3.000 con subsidio del 40 %', () => {
    const resultado = calcularVentaTeorica(1800n, [
      { unidades: 1, precio: d(3000), porcentajeCliente: d(40) },
    ]);
    expect(resultado.ventaTeorica.toNumber()).toBe(1800);
    expect(resultado.valorFacturarCliente.toNumber()).toBe(1200);
    expect(resultado.diferenciaVenta?.toNumber()).toBe(0);
  });

  it('suma ventas mixtas sin incluir el subsidio en el recaudo', () => {
    const resultado = calcularVentaTeorica(5700n, [
      { unidades: 2, precio: d(2000), porcentajeCliente: d(0) },
      { unidades: 1n, precio: d(3000), porcentajeCliente: d(40) },
      { unidades: 1n, precio: d(1000), porcentajeCliente: d(100) },
    ]);
    expect(resultado.ventaTeorica.toNumber()).toBe(5800);
    expect(resultado.valorFacturarCliente.toNumber()).toBe(2200);
    expect(resultado.diferenciaVenta?.toNumber()).toBe(-100);
  });

  it('indica por que no hay comparacion cuando falta una base o un precio', () => {
    const resultado = calcularVentaTeorica(0n, [
      { unidades: null, precio: d(1000), porcentajeCliente: d(0) },
      { unidades: 1n, precio: null, porcentajeCliente: d(0) },
    ]);
    expect(resultado.diferenciaVenta).toBeNull();
    expect(resultado.controles.map(c => c.inconsistencia)).toEqual(['SIN_BASE_COMPARABLE', 'SIN_PRECIO_CLIENTE']);
  });
});
