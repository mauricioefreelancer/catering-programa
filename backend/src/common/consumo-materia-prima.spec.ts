import { Prisma } from '@prisma/client';
import { calcularConsumoMateriaPrima } from './consumo-materia-prima';

const dec = (valor: number) => new Prisma.Decimal(valor);

describe('Control de materia prima', () => {
  it('suma dosis y tolvas y valora la diferencia en unidades de consumo', () => {
    const control = calcularConsumoMateriaPrima(
      [{ unidades: 10n, cantidadDosis: dec(7.5) }, { unidades: 25n, cantidadDosis: dec(5) }],
      [{ fisicoAnterior: 2, despachado: 1, fisicoActual: 2 }, { fisicoAnterior: 3, despachado: 0, fisicoActual: 3 }],
      dec(100), dec(4500),
    );
    expect(control.consumoTeorico?.toString()).toBe('200');
    expect(control.consumoReal?.toString()).toBe('100');
    expect(control.diferencia?.toString()).toBe('-100');
    expect(control.valorDiferencia?.toString()).toBe('4500');
    expect(control.inconsistencia).toBeNull();
  });

  it('no estima el fisico anterior ni un costo de diferencia cuando falta la base', () => {
    const control = calcularConsumoMateriaPrima(
      [{ unidades: 0n, cantidadDosis: dec(2) }],
      [{ fisicoAnterior: null, despachado: 0, fisicoActual: 4 }], dec(100), dec(4500),
    );
    expect(control.consumoTeorico?.toString()).toBe('0');
    expect(control.consumoReal).toBeNull();
    expect(control.valorDiferencia).toBeNull();
    expect(control.inconsistencia).toBe('SIN_FISICO_ANTERIOR');
  });

  it('identifica un insumo de receta sin tolva y una equivalencia no utilizable', () => {
    expect(calcularConsumoMateriaPrima([], [], dec(100), dec(4500)).inconsistencia).toBe('SIN_TOLVA_CONFIGURADA');
    expect(calcularConsumoMateriaPrima([], [], dec(0), dec(4500)).inconsistencia).toBe('EQUIVALENCIA_INVALIDA');
  });
});
