import { Prisma } from '@prisma/client';
import {
  calcularConsumoCategoria, costoRecetaEstandar, errorReceta, esPersonalizada, recetaParaBoton, varianteSugerida,
} from './receta-cafe';

const dec = (v: number) => new Prisma.Decimal(v);
const capuccinoGrano = [
  { categoria: 'CAFE_GRANO', cantidad: dec(8) }, { categoria: 'LECHE_POLVO', cantidad: dec(12) },
  { categoria: 'CHOCOLATE', cantidad: dec(7) }, { categoria: 'VASO', cantidad: dec(1) },
  { categoria: 'MEZCLADOR', cantidad: dec(1) }, { categoria: 'AZUCAR', cantidad: dec(5) },
];

describe('Receta de café', () => {
  it('valida la variante contra el café de la receta', () => {
    expect(errorReceta('GRANO', capuccinoGrano)).toBeNull();
    expect(errorReceta('SOLUBLE', capuccinoGrano)).toMatch(/soluble/);
    expect(errorReceta('SIN_CAFE', [{ categoria: 'CHOCOLATE', cantidad: dec(16) }, { categoria: 'VASO', cantidad: 1 }])).toBeNull();
    expect(errorReceta('SIN_CAFE', capuccinoGrano)).toMatch(/sin café/);
    expect(errorReceta('GRANO', [{ categoria: 'CAFE_GRANO', cantidad: 0 }])).toMatch(/mayor que 0/);
    expect(errorReceta('GRANO', [{ categoria: 'CAFE_GRANO', cantidad: 8 }, { categoria: 'CAFE_GRANO', cantidad: 8 }])).toMatch(/repetido/);
    expect(errorReceta('GRANO', [{ categoria: 'LECHE', cantidad: 8 }])).toMatch(/inválida/);
    expect(errorReceta('GRANO', [])).toMatch(/al menos/);
  });

  it('copia al botón solo los insumos que tiene la máquina', () => {
    const r = recetaParaBoton(capuccinoGrano, new Set(['CAFE_GRANO', 'LECHE_POLVO', 'CHOCOLATE', 'VASO']));
    expect(r.lineas.map(l => l.categoria)).toEqual(['CAFE_GRANO', 'LECHE_POLVO', 'CHOCOLATE', 'VASO']);
    expect(r.omitidas).toEqual(['MEZCLADOR', 'AZUCAR']);
  });

  it('marca como personalizada la dosis distinta de la estándar', () => {
    expect(esPersonalizada('CAFE_GRANO', dec(8), capuccinoGrano)).toBe(false);
    expect(esPersonalizada('CAFE_GRANO', dec(7), capuccinoGrano)).toBe(true);
    expect(esPersonalizada('AROMATICA_YERBABUENA', dec(7), capuccinoGrano)).toBe(true);
  });

  it('sugiere la variante según los cafés de la máquina', () => {
    expect(varianteSugerida(['GRANO', 'SOLUBLE'], new Set(['CAFE_SOLUBLE']))).toBe('SOLUBLE');
    expect(varianteSugerida(['GRANO', 'SOLUBLE'], new Set(['CAFE_GRANO', 'CAFE_SOLUBLE']))).toBe('GRANO');
    expect(varianteSugerida(['SIN_CAFE'], new Set(['CAFE_GRANO']))).toBe('SIN_CAFE');
    expect(varianteSugerida([], new Set())).toBeNull();
  });
});

describe('Control por categoría de insumo', () => {
  it('compara el teórico por NRQ con lo consumido de tolvas de distinta presentación', () => {
    // 300 tintos y 100 capuccinos a 8 g = 3.200 g. Salieron 2 bolsas de 1 kg y 3 de 500 g = 3.500 g.
    const r = calcularConsumoCategoria(
      [{ unidades: 300n, cantidadDosis: dec(8) }, { unidades: 100n, cantidadDosis: dec(8) }],
      [
        { fisicoAnterior: 3, despachado: 1, fisicoActual: 2, equivalencia: dec(1000), costoBase: dec(50000) },
        { fisicoAnterior: 4, despachado: 0, fisicoActual: 1, equivalencia: dec(500), costoBase: dec(25000) },
      ],
    );
    expect(r.consumoTeorico?.toString()).toBe('3200');
    expect(r.consumoReal?.toString()).toBe('3500');
    expect(r.diferencia?.toString()).toBe('300');
    expect(r.valorDiferencia?.toString()).toBe('15000');
    expect(r.inconsistencia).toBeNull();
  });

  it('informa por qué no se puede calcular', () => {
    const tolva = { fisicoAnterior: 1, despachado: 0, fisicoActual: 1, equivalencia: dec(50), costoBase: dec(10000) };
    expect(calcularConsumoCategoria([{ unidades: 1n, cantidadDosis: dec(1) }], []).inconsistencia).toBe('SIN_TOLVA_CONFIGURADA');
    expect(calcularConsumoCategoria([{ unidades: null, cantidadDosis: dec(1) }], [tolva]).inconsistencia).toBe('SIN_LECTURA_NRQ');
    expect(calcularConsumoCategoria([{ unidades: 1n, cantidadDosis: dec(1) }], [{ ...tolva, fisicoAnterior: null }]).inconsistencia).toBe('SIN_FISICO_ANTERIOR');
    expect(calcularConsumoCategoria([{ unidades: 1n, cantidadDosis: dec(1) }], [{ ...tolva, equivalencia: dec(0) }]).inconsistencia).toBe('EQUIVALENCIA_INVALIDA');
  });
});

describe('Costo estándar del producto terminado', () => {
  it('usa la variante grano y el costo por gramo o unidad de cada categoría', () => {
    const recetas = [
      ...capuccinoGrano.map(l => ({ ...l, variante: 'GRANO' })),
      { variante: 'SOLUBLE', categoria: 'CAFE_SOLUBLE', cantidad: dec(2) },
    ];
    const costos = new Map([
      ['CAFE_GRANO', dec(50)], ['LECHE_POLVO', dec(15)], ['CHOCOLATE', dec(20)],
      ['VASO', dec(200)], ['MEZCLADOR', dec(10)], ['AZUCAR', dec(4)],
    ]);
    // 8×50 + 12×15 + 7×20 + 200 + 10 + 5×4 = 950
    expect(costoRecetaEstandar(recetas, costos)?.toString()).toBe('950');
    expect(costoRecetaEstandar([], costos)).toBeNull();
  });
});
