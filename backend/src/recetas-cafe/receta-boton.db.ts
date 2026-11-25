import { Prisma } from '@prisma/client';
import { esVarianteCafe, recetaParaBoton, VarianteCafe, varianteSugerida } from '../common/receta-cafe';

type Tx = Prisma.TransactionClient;

/** Categorías de insumo que tiene la máquina en sus tolvas. */
export async function categoriasMaquina(tx: Tx, idMaquina: number) {
  const tolvas = await tx.mapaMateriaPrima.findMany({
    where: { idMaquina, producto: { tipoProducto: 'MATERIA_PRIMA', categoriaInsumo: { not: null } } },
    select: { producto: { select: { categoriaInsumo: true } } },
  });
  return new Set(tolvas.map(t => t.producto.categoriaInsumo!));
}

export async function variantesDisponibles(tx: Tx, idProdTerm: number) {
  const filas = await tx.recetasEstandar.findMany({
    where: { idProdTerm }, select: { varianteCafe: true }, distinct: ['varianteCafe'],
  });
  return filas.map(f => f.varianteCafe).filter(esVarianteCafe);
}

/**
 * Arma la receta del botón desde la estándar de su producto y variante, con solo los
 * insumos que la máquina tiene. Reemplaza la receta anterior del botón.
 */
export async function reconstruirRecetaBoton(
  tx: Tx, boton: { idMapaNrq: number; idMaquina: number; idProdTerm: number }, variante?: VarianteCafe | null,
) {
  const categorias = await categoriasMaquina(tx, boton.idMaquina);
  const elegida = variante ?? varianteSugerida(await variantesDisponibles(tx, boton.idProdTerm), categorias);
  const estandar = elegida ? await tx.recetasEstandar.findMany({
    where: { idProdTerm: boton.idProdTerm, varianteCafe: elegida },
  }) : [];
  const { lineas, omitidas } = recetaParaBoton(
    estandar.map(e => ({ categoria: e.categoriaInsumo, cantidad: e.cantidadDosis })), categorias);
  await tx.recetaBoton.deleteMany({ where: { idMapaNrq: boton.idMapaNrq } });
  if (lineas.length) {
    await tx.recetaBoton.createMany({ data: lineas.map(l => ({
      idMapaNrq: boton.idMapaNrq, categoriaInsumo: l.categoria, cantidadDosis: l.cantidad, personalizada: false,
    })) });
  }
  await tx.mapaCafeNrq.update({ where: { idMapaNrq: boton.idMapaNrq }, data: { varianteCafe: elegida } });
  return { variante: elegida, lineas: lineas.length, omitidas };
}

/** Contexto de auditoría para los triggers dentro de la transacción. */
export async function contextoAuditoria(tx: Tx, idUsuario?: number | null) {
  await tx.$queryRaw`SELECT set_config('app.current_user_id', ${idUsuario ? String(idUsuario) : ''}, TRUE)`;
}
