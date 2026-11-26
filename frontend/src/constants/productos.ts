// Catálogos cerrados compartidos por los formularios de producto (Productos e Ingresos).

// Categorías de insumo de las cafeteras. Deben coincidir con backend/src/common/receta-cafe.ts.
export const CATEGORIAS_INSUMO: { value: string; color: string; label: string; unidadConsumo: string }[] = [
  { value: 'CAFE_GRANO', color: 'orange', label: '☕ Café grano', unidadConsumo: 'Gramo' },
  { value: 'CAFE_SOLUBLE', color: 'volcano', label: '☕ Café soluble', unidadConsumo: 'Gramo' },
  { value: 'LECHE_POLVO', color: 'blue', label: '🥛 Leche en polvo', unidadConsumo: 'Gramo' },
  { value: 'AROMATICA', color: 'green', label: '🌿 Aromática', unidadConsumo: 'Gramo' },
  { value: 'CHOCOLATE', color: 'purple', label: '🍫 Chocolate', unidadConsumo: 'Gramo' },
  { value: 'VASO', color: 'cyan', label: '🥤 Vaso', unidadConsumo: 'Unidad' },
  { value: 'MEZCLADOR', color: 'geekblue', label: '🥄 Mezclador', unidadConsumo: 'Unidad' },
  { value: 'AZUCAR', color: 'gold', label: '🍬 Azúcar', unidadConsumo: 'Gramo' },
]

/** Presentación en que se compra y se despacha el producto. */
export const UNIDADES_COMPRA = [
  'Unidad', 'Caja', 'Paquete', 'Bolsa', 'Display', 'Bulto', 'Kilo', 'Libra', 'Frasco', 'Lata', 'Botella', 'Galón',
].map((u) => ({ value: u, label: u }))

/** Fracción en que se consume (la dosis de la receta o la unidad vendida). */
export const UNIDADES_CONSUMO = ['Unidad', 'Gramo', 'Mililitro'].map((u) => ({ value: u, label: u }))

export const ETIQUETA_EQUIVALENCIA = 'Escriba el valor en gramos o unidades que contenga el empaque a despachar'
export const AYUDA_EQUIVALENCIA = 'Ej: bolsa de café de 1 kg = 1000 · paquete de 50 vasos = 50 · caja de 24 snacks = 24'

export const unidadConsumoDeCategoria = (categoria?: string | null) =>
  CATEGORIAS_INSUMO.find((c) => c.value === categoria)?.unidadConsumo
