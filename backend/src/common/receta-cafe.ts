import { Prisma } from '@prisma/client';

/** Categorías de insumo de las cafeteras. La receta apunta a la categoría, no a la marca. */
export const CATEGORIAS_INSUMO = [
  { clave: 'CAFE_GRANO', nombre: 'Café en grano', unidad: 'g', cafe: true },
  { clave: 'CAFE_SOLUBLE', nombre: 'Café soluble', unidad: 'g', cafe: true },
  { clave: 'LECHE_POLVO', nombre: 'Leche en polvo', unidad: 'g', cafe: false },
  { clave: 'AROMATICA_FRUTOS_ROJOS', nombre: 'Aromática frutos rojos', unidad: 'g', cafe: false },
  { clave: 'AROMATICA_YERBABUENA', nombre: 'Aromática yerbabuena', unidad: 'g', cafe: false },
  { clave: 'CHOCOLATE', nombre: 'Chocolate', unidad: 'g', cafe: false },
  { clave: 'VASO', nombre: 'Vaso', unidad: 'und', cafe: false },
  { clave: 'MEZCLADOR', nombre: 'Mezclador', unidad: 'und', cafe: false },
  { clave: 'AZUCAR', nombre: 'Azúcar', unidad: 'g', cafe: false },
] as const;

export type CategoriaInsumo = typeof CATEGORIAS_INSUMO[number]['clave'];
export const VARIANTES_CAFE = ['GRANO', 'SOLUBLE', 'SIN_CAFE'] as const;
export type VarianteCafe = typeof VARIANTES_CAFE[number];

const CLAVES = new Set<string>(CATEGORIAS_INSUMO.map(c => c.clave));
export const esCategoriaInsumo = (valor: unknown): valor is CategoriaInsumo => typeof valor === 'string' && CLAVES.has(valor);
export const esVarianteCafe = (valor: unknown): valor is VarianteCafe =>
  typeof valor === 'string' && (VARIANTES_CAFE as readonly string[]).includes(valor);
export const unidadCategoria = (categoria: string) => CATEGORIAS_INSUMO.find(c => c.clave === categoria)?.unidad ?? 'g';
export const nombreCategoria = (categoria: string) => CATEGORIAS_INSUMO.find(c => c.clave === categoria)?.nombre ?? categoria;
/** Tipo_Cafe que se guarda en el producto de materia prima según su categoría. */
export const tipoCafeDeCategoria = (categoria: string | null | undefined) =>
  categoria === 'CAFE_GRANO' ? 'GRANO' : categoria === 'CAFE_SOLUBLE' ? 'SOLUBLE' : null;

export type LineaReceta = { categoria: string; cantidad: Prisma.Decimal };

/** Valida una receta (estándar o de botón) y devuelve el mensaje del primer error. */
export function errorReceta(variante: string, lineas: { categoria: string; cantidad: Prisma.Decimal | number }[]) {
  if (!esVarianteCafe(variante)) return 'La variante debe ser GRANO, SOLUBLE o SIN_CAFE';
  if (!lineas.length) return 'La receta debe tener al menos un insumo';
  const vistas = new Set<string>();
  for (const { categoria, cantidad } of lineas) {
    if (!esCategoriaInsumo(categoria)) return `Categoría de insumo inválida: ${categoria}`;
    if (vistas.has(categoria)) return `El insumo ${nombreCategoria(categoria)} está repetido`;
    vistas.add(categoria);
    const valor = new Prisma.Decimal(cantidad);
    if (!valor.isFinite() || valor.lte(0)) return `La dosis de ${nombreCategoria(categoria)} debe ser mayor que 0`;
  }
  const grano = vistas.has('CAFE_GRANO');
  const soluble = vistas.has('CAFE_SOLUBLE');
  if (variante === 'GRANO' && (!grano || soluble)) return 'La variante grano lleva café en grano y no café soluble';
  if (variante === 'SOLUBLE' && (!soluble || grano)) return 'La variante soluble lleva café soluble y no café en grano';
  if (variante === 'SIN_CAFE' && (grano || soluble)) return 'La variante sin café no puede llevar café';
  return null;
}

/**
 * Receta de un botón a partir de la estándar: solo los insumos que la máquina tiene
 * en sus tolvas. Devuelve también los que quedaron por fuera para mostrarlos.
 */
export function recetaParaBoton(estandar: LineaReceta[], categoriasMaquina: Set<string>) {
  return {
    lineas: estandar.filter(l => categoriasMaquina.has(l.categoria)),
    omitidas: estandar.filter(l => !categoriasMaquina.has(l.categoria)).map(l => l.categoria),
  };
}

/** Una línea es personalizada si su dosis difiere de la estándar o el insumo no está en la estándar. */
export function esPersonalizada(categoria: string, cantidad: Prisma.Decimal, estandar: LineaReceta[]) {
  const base = estandar.find(l => l.categoria === categoria);
  return !base || !base.cantidad.eq(cantidad);
}

/** Variante que se asigna a un botón nuevo según los cafés que tiene la máquina. */
export function varianteSugerida(disponibles: VarianteCafe[], categoriasMaquina: Set<string>): VarianteCafe | null {
  if (!disponibles.length) return null;
  if (disponibles.includes('SIN_CAFE') && !disponibles.some(v => v !== 'SIN_CAFE')) return 'SIN_CAFE';
  if (categoriasMaquina.has('CAFE_GRANO') && disponibles.includes('GRANO')) return 'GRANO';
  if (categoriasMaquina.has('CAFE_SOLUBLE') && disponibles.includes('SOLUBLE')) return 'SOLUBLE';
  return disponibles[0];
}

type DosisBoton = { unidades: bigint | null; cantidadDosis: Prisma.Decimal };
type TolvaCategoria = {
  fisicoAnterior: number | null; despachado: number; fisicoActual: number;
  equivalencia: Prisma.Decimal; costoBase: Prisma.Decimal;
};

/**
 * Control de una categoría de insumo en una visita.
 * Teórico = Σ unidades NRQ × dosis del botón. Real = Σ (físico anterior + despachado
 * − físico actual) × equivalencia de cada tolva. La diferencia se valora al costo
 * promedio por unidad de receta de las tolvas de esa categoría.
 */
export function calcularConsumoCategoria(dosis: DosisBoton[], tolvas: TolvaCategoria[]) {
  const cero = new Prisma.Decimal(0);
  const consumoTeorico = dosis.some(d => d.unidades == null) ? null
    : dosis.reduce((total, d) => total.plus(d.cantidadDosis.mul(d.unidades!.toString())), cero);
  const invalida = tolvas.some(t => t.equivalencia.lte(0));
  const consumoReal = invalida || !tolvas.length || tolvas.some(t => t.fisicoAnterior == null) ? null
    : tolvas.reduce((total, t) => total.plus(t.equivalencia.mul(t.fisicoAnterior! + t.despachado - t.fisicoActual)), cero);
  const diferencia = consumoReal != null && consumoTeorico != null ? consumoReal.minus(consumoTeorico) : null;
  const costoUnitario = invalida || !tolvas.length ? null
    : tolvas.reduce((total, t) => total.plus(t.costoBase.div(t.equivalencia)), cero).div(tolvas.length);
  return {
    consumoTeorico, consumoReal, diferencia, costoUnitario,
    valorDiferencia: diferencia != null && costoUnitario != null ? diferencia.abs().mul(costoUnitario).toDecimalPlaces(2) : null,
    inconsistencia: invalida ? 'EQUIVALENCIA_INVALIDA' : !tolvas.length ? 'SIN_TOLVA_CONFIGURADA'
      : consumoReal == null ? 'SIN_FISICO_ANTERIOR' : consumoTeorico == null ? 'SIN_LECTURA_NRQ' : null,
  };
}

/**
 * Costo estándar de un producto terminado: Σ dosis × costo promedio por unidad de la
 * categoría (costo base del empaque / equivalencia). Toma la variante grano, luego
 * soluble y luego sin café.
 */
export function costoRecetaEstandar(
  recetas: { variante: string; categoria: string; cantidad: Prisma.Decimal }[],
  costoPorCategoria: Map<string, Prisma.Decimal>,
) {
  const variante = ['GRANO', 'SOLUBLE', 'SIN_CAFE'].find(v => recetas.some(r => r.variante === v));
  if (!variante) return null;
  return recetas.filter(r => r.variante === variante)
    .reduce((total, r) => total.plus(r.cantidad.mul(costoPorCategoria.get(r.categoria) ?? 0)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
}
