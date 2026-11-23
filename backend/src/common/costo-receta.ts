import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function bloquearCostos(tx: Prisma.TransactionClient) {
  // Serializa cambios de compras y recetas para evitar recálculos con bases distintas.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(771431, 1)`;
}

export function costoDosis(dosis: Prisma.Decimal, costo: Prisma.Decimal, equivalencia: Prisma.Decimal) {
  if (equivalencia.lte(0)) throw new BadRequestException('La equivalencia de materia prima debe ser positiva');
  return dosis.mul(costo).div(equivalencia);
}

export async function recalcularReceta(tx: Prisma.TransactionClient, idProdTerm: number) {
  const lineas = await tx.recetasDosificados.findMany({
    where: { idProdTerm },
    include: { materiaPrima: { select: { costoBase: true, equivalencia: true } } },
  });
  let total = new Prisma.Decimal(0);
  for (const linea of lineas) {
    const costo = costoDosis(linea.cantidadDosis, linea.materiaPrima.costoBase, linea.materiaPrima.equivalencia);
    await tx.recetasDosificados.update({ where: { idReceta: linea.idReceta }, data: { costoProporcional: costo } });
    total = total.plus(costo);
  }
  const producto = await tx.productos.findUniqueOrThrow({ where: { idProducto: idProdTerm }, select: { porcentajeImp: true } });
  await tx.productos.update({
    where: { idProducto: idProdTerm },
    data: { costoBase: total, costoTotal: total.mul(producto.porcentajeImp.div(100).plus(1)) },
  });
}

export async function recalcularPorMateriasPrimas(tx: Prisma.TransactionClient, ids: number[]) {
  if (!ids.length) return;
  const recetas = await tx.recetasDosificados.findMany({
    where: { idMatPrima: { in: ids } }, select: { idProdTerm: true }, distinct: ['idProdTerm'],
  });
  for (const { idProdTerm } of recetas.sort((a, b) => a.idProdTerm - b.idProdTerm)) {
    await recalcularReceta(tx, idProdTerm);
  }
}
