import { Prisma } from '@prisma/client';
import { agruparFacturacionCliente } from './facturacion-cliente';

const dec = (v: number) => new Prisma.Decimal(v);
const base = {
  idMapaMp: 5, idMapaNrq: null, idProdTerm: 8, lecturaAnterior: 10n, lecturaActual: 11n, unidades: 1n,
  precioUnitario: dec(3000), porcentajeCliente: dec(40),
  visita: { idCliente: 3, cliente: { razonSocial: 'Prueba' } }, producto: { nombreProducto: 'Snack' },
};

describe('Facturacion al cliente', () => {
  it('usa cada snapshot para valorar un mismo producto y tipo', () => {
    const [fila] = agruparFacturacionCliente(1, 'ESPECIAL', [
      base, { ...base, lecturaAnterior: 11n, lecturaActual: 13n, unidades: 2n, precioUnitario: dec(4000), porcentajeCliente: dec(25) },
    ]);
    expect(fila.NRQ_Diferencia).toBe(3n);
    expect(fila.NRQ_Inicial).toBe(10n);
    expect(fila.NRQ_Final).toBe(13n);
    expect(fila.tipo).toBe('SUBSIDIO_PARCIAL');
    expect(fila.valorVentaTotal.toString()).toBe('11000');
    expect(fila.total.toString()).toBe('3200');
  });

  it('distingue el subsidio total, excluye cafe normal y no presume porcentajes historicos', () => {
    const filas = agruparFacturacionCliente(1, 'ESPECIAL', [
      { ...base, porcentajeCliente: dec(100) },
      { ...base, idMapaMp: null, idMapaNrq: 7, porcentajeCliente: dec(0) },
      { ...base, idMapaMp: null, idMapaNrq: 7, porcentajeCliente: null },
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].tipo).toBe('SUBSIDIO_TOTAL');
    expect(filas[0].total.toString()).toBe('3000');
  });
});
