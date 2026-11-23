import { diferenciaContador, umbralDiferenciaVenta, vendidasPorEspiral } from './contadores';

describe('Contadores de visita', () => {
  it('calcula diferencia y permite lecturas iguales', () => {
    expect(diferenciaContador(30n, 45n)).toBe(15n);
    expect(diferenciaContador(30n, 30n)).toBe(0n);
  });
  it('exige confirmacion cuando una lectura disminuye', () => {
    expect(() => diferenciaContador(30n, 5n)).toThrow(RangeError);
    expect(diferenciaContador(30n, 5n, true)).toBe(5n);
  });
  it('usa el despacho real y conserva resultados negativos para revision', () => {
    expect(vendidasPorEspiral(4, 3, 2)).toBe(5);
    expect(vendidasPorEspiral(4, 3, 8)).toBe(-1);
  });
  it('usa 10000 COP por defecto y reconoce cambios de configuracion', () => {
    expect(umbralDiferenciaVenta(undefined)).toBe(10_000);
    expect(umbralDiferenciaVenta('15000')).toBe(15_000);
    expect(umbralDiferenciaVenta('-1')).toBe(10_000);
  });
});
