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

/**
 * Materia prima: se compra y despacha en bolsa (se consume en gramos) o en paquete
 * (se consume por unidades). No se manejan líquidos.
 */
export const UNIDADES_COMPRA = [
  { value: 'Bolsa', label: 'Bolsa (se consume en gramos)', consumo: 'Gramo' },
  { value: 'Paquete', label: 'Paquete (se consume por unidades)', consumo: 'Unidad' },
]

export const UNIDADES_CONSUMO = ['Gramo', 'Unidad'].map((u) => ({ value: u, label: u }))

export const consumoDeCompra = (compra?: string | null) => UNIDADES_COMPRA.find((u) => u.value === compra)?.consumo

/** Unidad de compra que corresponde a la categoría: gramos → Bolsa, unidades → Paquete. */
export const compraDeCategoria = (categoria?: string | null) => {
  const consumo = CATEGORIAS_INSUMO.find((c) => c.value === categoria)?.unidadConsumo
  return UNIDADES_COMPRA.find((u) => u.consumo === consumo)?.value
}

export const ETIQUETA_EQUIVALENCIA = 'Escriba el valor en gramos o unidades que contenga el empaque a despachar'
export const AYUDA_EQUIVALENCIA = 'Ej: bolsa de café de 1 kg = 1000 · paquete de 50 vasos = 50 · paquete de mezcladores = 1000'

export const unidadConsumoDeCategoria = (categoria?: string | null) =>
  CATEGORIAS_INSUMO.find((c) => c.value === categoria)?.unidadConsumo
