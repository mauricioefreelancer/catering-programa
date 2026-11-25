import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { costoRecetaEstandar } from './receta-cafe';

export async function bloquearCostos(tx: Prisma.TransactionClient) {
  // Serializa cambios de compras y recetas para evitar recálculos con bases distintas.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(771431, 1)`;
}

export function costoDosis(dosis: Prisma.Decimal, costo: Prisma.Decimal, equivalencia: Prisma.Decimal) {
  if (equivalencia.lte(0)) throw new BadRequestException('La equivalencia de materia prima debe ser positiva');
  return dosis.mul(costo).div(equivalencia);
}

/**
 * Costo por gramo o unidad de cada categoría de insumo: promedio de
 * (último costo de compra / equivalencia) de las materias primas activas de la categoría.
 */
export async function costosPorCategoria(tx: Prisma.TransactionClient) {
  const insumos = await tx.productos.findMany({
    where: { tipoProducto: 'MATERIA_PRIMA', estado: true, categoriaInsumo: { not: null }, equivalencia: { gt: 0 } },
    select: { categoriaInsumo: true, costoBase: true, equivalencia: true },
  });
  const grupos = new Map<string, Prisma.Decimal[]>();
  for (const i of insumos) {
    const lista = grupos.get(i.categoriaInsumo!) ?? [];
    lista.push(i.costoBase.div(i.equivalencia));
    grupos.set(i.categoriaInsumo!, lista);
  }
  return new Map([...grupos].map(([categoria, costos]) => [
    categoria, costos.reduce((total, c) => total.plus(c), new Prisma.Decimal(0)).div(costos.length),
  ]));
}

/** Costo estándar del producto terminado desde su receta estándar. */
export async function recalcularReceta(tx: Prisma.TransactionClient, idProdTerm: number, costos?: Map<string, Prisma.Decimal>) {
  const recetas = await tx.recetasEstandar.findMany({ where: { idProdTerm } });
  const costo = costoRecetaEstandar(
    recetas.map(r => ({ variante: r.varianteCafe, categoria: r.categoriaInsumo, cantidad: r.cantidadDosis })),
    costos ?? await costosPorCategoria(tx),
  ) ?? new Prisma.Decimal(0);
  const producto = await tx.productos.findUniqueOrThrow({ where: { idProducto: idProdTerm }, select: { porcentajeImp: true } });
  await tx.productos.update({
    where: { idProducto: idProdTerm },
    data: { costoBase: costo, costoTotal: costo.mul(producto.porcentajeImp.div(100).plus(1)).toDecimalPlaces(2) },
  });
}

/** Recalcula los productos terminados cuyas recetas usan las categorías de estas materias primas. */
export async function recalcularPorMateriasPrimas(tx: Prisma.TransactionClient, ids: number[], categoriasExtra: string[] = []) {
  if (!ids.length && !categoriasExtra.length) return;
  const insumos = ids.length ? await tx.productos.findMany({
    where: { idProducto: { in: ids }, categoriaInsumo: { not: null } }, select: { categoriaInsumo: true },
  }) : [];
  const categorias = [...new Set([...insumos.map(i => i.categoriaInsumo!), ...categoriasExtra])];
  if (!categorias.length) return;
  const recetas = await tx.recetasEstandar.findMany({
    where: { categoriaInsumo: { in: categorias } }, select: { idProdTerm: true }, distinct: ['idProdTerm'],
  });
  const costos = await costosPorCategoria(tx);
  for (const { idProdTerm } of recetas.sort((a, b) => a.idProdTerm - b.idProdTerm)) {
    await recalcularReceta(tx, idProdTerm, costos);
  }
}
