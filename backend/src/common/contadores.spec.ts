import { diferenciaContador, vendidasPorEspiral } from './contadores';

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
});
