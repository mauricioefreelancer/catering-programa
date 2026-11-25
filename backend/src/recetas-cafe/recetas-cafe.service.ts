import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { bloquearCostos, recalcularReceta } from '../common/costo-receta';
import {
  CATEGORIAS_INSUMO, errorReceta, esCategoriaInsumo, esPersonalizada, esVarianteCafe, nombreCategoria,
  unidadCategoria, VARIANTES_CAFE, VarianteCafe,
} from '../common/receta-cafe';
import { rangoColombia } from '../common/fecha-colombia';
import {
  categoriasMaquina, contextoAuditoria, reconstruirRecetaBoton, variantesDisponibles,
} from './receta-boton.db';

type LineaEntrada = { categoria: string; cantidad: number | string };

const decimal = (valor: number | string) => {
  try { return new Prisma.Decimal(valor); } catch { throw new BadRequestException(`Dosis inválida: ${valor}`); }
};
const numero = (valor: Prisma.Decimal | null | undefined) => valor == null ? null : Number(valor);

@Injectable()
export class RecetasCafeService {
  constructor(private prisma: PrismaService) {}

  categorias() {
    return { categorias: CATEGORIAS_INSUMO, variantes: VARIANTES_CAFE };
  }

  // ===================== Recetas estándar de la empresa =====================

  async estandar() {
    const productos = await this.prisma.productos.findMany({
      where: { tipoProducto: 'DOSIFICADO' },
      orderBy: { nombreProducto: 'asc' },
      select: {
        idProducto: true, nombreProducto: true, costoBase: true, costoTotal: true, estado: true,
        recetasEstandar: { select: { varianteCafe: true, categoriaInsumo: true, cantidadDosis: true } },
      },
    });
    return productos.map(({ recetasEstandar, ...p }) => ({
      ...p,
      costoBase: Number(p.costoBase), costoTotal: Number(p.costoTotal),
      recetas: Object.fromEntries(VARIANTES_CAFE.map(v => [v, Object.fromEntries(
        recetasEstandar.filter(r => r.varianteCafe === v).map(r => [r.categoriaInsumo, Number(r.cantidadDosis)]),
      )])),
    }));
  }

  async guardarEstandar(idProdTerm: number, variante: string, lineas: LineaEntrada[], idUsuario?: number | null) {
    if (!Array.isArray(lineas)) throw new BadRequestException('lineas debe ser un arreglo');
    const limpias = lineas.filter(l => l && l.cantidad !== '' && l.cantidad != null && Number(l.cantidad) !== 0)
      .map(l => ({ categoria: String(l.categoria), cantidad: decimal(l.cantidad) }));
    return this.prisma.$transaction(async tx => {
      await bloquearCostos(tx);
      await contextoAuditoria(tx, idUsuario);
      await this.productoDosificado(tx, idProdTerm);
      if (!esVarianteCafe(variante)) throw new BadRequestException('La variante debe ser GRANO, SOLUBLE o SIN_CAFE');
      if (limpias.length) {
        const error = errorReceta(variante, limpias);
        if (error) throw new BadRequestException(error);
      }
      await tx.recetasEstandar.deleteMany({
        where: { idProdTerm, varianteCafe: variante, categoriaInsumo: { notIn: limpias.map(l => l.categoria) } },
      });
      for (const l of limpias) {
        await tx.recetasEstandar.upsert({
          where: { idProdTerm_varianteCafe_categoriaInsumo: { idProdTerm, varianteCafe: variante, categoriaInsumo: l.categoria } },
          update: { cantidadDosis: l.cantidad, fechaActualizacion: new Date() },
          create: { idProdTerm, varianteCafe: variante, categoriaInsumo: l.categoria, cantidadDosis: l.cantidad },
        });
      }
      await recalcularReceta(tx, idProdTerm);
      return { guardadas: limpias.length, botonesAfectados: await this.botonesQueUsan(tx, idProdTerm, variante) };
    });
  }

  /** Aplica la receta estándar a los botones no personalizados que usan ese producto y variante. */
  async aplicarEstandar(idProdTerm: number, variante: string, idUsuario?: number | null) {
    if (!esVarianteCafe(variante)) throw new BadRequestException('Variante inválida');
    return this.prisma.$transaction(async tx => {
      await contextoAuditoria(tx, idUsuario);
      const botones = await this.botonesQueUsan(tx, idProdTerm, variante);
      const aplicados: number[] = [];
      for (const b of botones.filter(b => !b.personalizado)) {
        await reconstruirRecetaBoton(tx, { idMapaNrq: b.idMapaNrq, idMaquina: b.idMaquina, idProdTerm }, variante);
        aplicados.push(b.idMapaNrq);
      }
      return { aplicados: aplicados.length, personalizadosSinCambio: botones.filter(b => b.personalizado) };
    });
  }

  private async botonesQueUsan(tx: Prisma.TransactionClient, idProdTerm: number, variante: string) {
    const botones = await tx.mapaCafeNrq.findMany({
      where: { idProdTerm, varianteCafe: variante },
      select: { idMapaNrq: true, idMaquina: true, opcionBoton: true, maquina: { select: { serial: true } },
        receta: { select: { personalizada: true } } },
      orderBy: [{ idMaquina: 'asc' }, { opcionBoton: 'asc' }],
    });
    return botones.map(b => ({
      idMapaNrq: b.idMapaNrq, idMaquina: b.idMaquina, serial: b.maquina.serial, boton: b.opcionBoton,
      personalizado: b.receta.some(r => r.personalizada),
    }));
  }

  private async productoDosificado(tx: Prisma.TransactionClient, idProducto: number) {
    const producto = await tx.productos.findUnique({ where: { idProducto } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.tipoProducto !== 'DOSIFICADO') throw new BadRequestException('Solo los productos dosificados llevan receta');
    return producto;
  }

  // ===================== Cafetera: recetas por botón =====================

  async vistaCafetera(idMaquina: number) {
    const maquina = await this.prisma.maquinasYTiendas.findUnique({
      where: { idMaquina },
      include: {
        mapaMateriaPrima: { include: { producto: true }, orderBy: { espiralCodigo: 'asc' } },
        mapaCafeNrq: {
          orderBy: { opcionBoton: 'asc' },
          include: { productoTerminado: { select: { nombreProducto: true, recetasEstandar: true } }, receta: true },
        },
      },
    });
    if (!maquina) throw new NotFoundException('Máquina no encontrada');
    const precios = maquina.idCliente ? await this.prisma.preciosCliente.findMany({
      where: { idCliente: maquina.idCliente, idProducto: { in: maquina.mapaCafeNrq.map(b => b.idProdTerm) } },
    }) : [];

    const tolvas = maquina.mapaMateriaPrima
      .filter(t => t.producto.tipoProducto === 'MATERIA_PRIMA')
      .map(t => ({
        idMapaMp: t.idMapaMp, codigo: t.espiralCodigo, idProducto: t.idProducto, producto: t.producto.nombreProducto,
        categoria: t.producto.categoriaInsumo, nombreCategoria: t.producto.categoriaInsumo ? nombreCategoria(t.producto.categoriaInsumo) : null,
        unidad: t.producto.categoriaInsumo ? unidadCategoria(t.producto.categoriaInsumo) : null,
        equivalencia: Number(t.producto.equivalencia), capacidadMax: t.capacidadMax, unidadCompra: t.producto.unidadCompra,
        costoUnidad: Number(t.producto.equivalencia) > 0 ? Number(t.producto.costoBase) / Number(t.producto.equivalencia) : null,
      }));
    const porCategoria = new Map<string, typeof tolvas>();
    for (const t of tolvas) if (t.categoria) porCategoria.set(t.categoria, [...(porCategoria.get(t.categoria) ?? []), t]);

    const botones = maquina.mapaCafeNrq.map(b => {
      const variante = b.varianteCafe;
      const estandar = b.productoTerminado.recetasEstandar.filter(e => e.varianteCafe === variante);
      const lineas = b.receta.sort((x, y) => x.categoriaInsumo.localeCompare(y.categoriaInsumo)).map(r => {
        const base = estandar.find(e => e.categoriaInsumo === r.categoriaInsumo);
        const tolvasCat = porCategoria.get(r.categoriaInsumo) ?? [];
        const costos = tolvasCat.map(t => t.costoUnidad).filter((c): c is number => c != null);
        const costoUnidad = costos.length ? costos.reduce((a, c) => a + c, 0) / costos.length : null;
        const cantidad = Number(r.cantidadDosis);
        const capacidad = tolvasCat.reduce((total, t) => total + t.capacidadMax * t.equivalencia, 0);
        return {
          categoria: r.categoriaInsumo, nombre: nombreCategoria(r.categoriaInsumo), unidad: unidadCategoria(r.categoriaInsumo),
          cantidad, estandar: numero(base?.cantidadDosis), diferencia: base ? cantidad - Number(base.cantidadDosis) : null,
          personalizada: r.personalizada, tieneTolva: tolvasCat.length > 0,
          costo: costoUnidad == null ? null : Math.round(costoUnidad * cantidad * 100) / 100,
          tazasPorCapacidad: cantidad > 0 && tolvasCat.length ? Math.floor(capacidad / cantidad) : null,
        };
      });
      const enReceta = new Set(lineas.map(l => l.categoria));
      const costoPorTaza = lineas.every(l => l.costo != null) && lineas.length
        ? Math.round(lineas.reduce((a, l) => a + l.costo!, 0) * 100) / 100 : null;
      const precio = precios.find(p => p.idProducto === b.idProdTerm);
      const precioCliente = precio ? Number(precio.precioVenta) : null;
      return {
        idMapaNrq: b.idMapaNrq, boton: b.opcionBoton, idProdTerm: b.idProdTerm, producto: b.productoTerminado.nombreProducto,
        varianteCafe: variante, porcentajeCliente: Number(b.porcentajeCliente),
        variantesDisponibles: VARIANTES_CAFE.filter(v => b.productoTerminado.recetasEstandar.some(e => e.varianteCafe === v)),
        personalizado: lineas.some(l => l.personalizada),
        lineas,
        omitidas: estandar.filter(e => !porCategoria.has(e.categoriaInsumo)).map(e => nombreCategoria(e.categoriaInsumo)),
        faltantesEnReceta: estandar.filter(e => porCategoria.has(e.categoriaInsumo) && !enReceta.has(e.categoriaInsumo))
          .map(e => nombreCategoria(e.categoriaInsumo)),
        sinTolva: lineas.filter(l => !l.tieneTolva).map(l => l.nombre),
        costoPorTaza, precioCliente,
        margen: precioCliente && costoPorTaza != null ? Math.round((precioCliente - costoPorTaza) / precioCliente * 10000) / 100 : null,
        tazasPosibles: lineas.length && lineas.every(l => l.tazasPorCapacidad != null)
          ? Math.min(...lineas.map(l => l.tazasPorCapacidad!)) : null,
      };
    });
    const categorias = new Set(porCategoria.keys());
    const tieneGrano = categorias.has('CAFE_GRANO');
    const tieneSoluble = categorias.has('CAFE_SOLUBLE');
    const listaParaOperar = tolvas.length > 0 && botones.length > 0 && botones.every(b => b.lineas.length > 0 && !b.sinTolva.length);
    return {
      maquina: { idMaquina, serial: maquina.serial, tipo: maquina.tipo, idCliente: maquina.idCliente },
      tipoCafe: tieneGrano && tieneSoluble ? 'AMBOS' : tieneGrano ? 'GRANO' : tieneSoluble ? 'SOLUBLE' : 'SIN_CAFE',
      categorias: [...categorias], tolvas, botones, listaParaOperar,
      tolvasSinCategoria: tolvas.filter(t => !t.categoria).map(t => t.producto),
    };
  }

  /** Guarda la receta de un botón; sin líneas la restaura desde la estándar. */
  async guardarRecetaBoton(
    idMaquina: number, idMapaNrq: number, body: { varianteCafe?: string; lineas?: LineaEntrada[] }, idUsuario?: number | null,
  ) {
    return this.prisma.$transaction(async tx => {
      await contextoAuditoria(tx, idUsuario);
      const boton = await tx.mapaCafeNrq.findUnique({ where: { idMapaNrq } });
      if (!boton || boton.idMaquina !== idMaquina) throw new NotFoundException('El botón no pertenece a la máquina');
      const variante = body.varianteCafe ?? boton.varianteCafe;
      if (!esVarianteCafe(variante)) throw new BadRequestException('Elige la variante del botón: GRANO, SOLUBLE o SIN_CAFE');
      if (!body.lineas) {
        const disponibles = await variantesDisponibles(tx, boton.idProdTerm);
        if (!disponibles.includes(variante)) {
          throw new BadRequestException('El producto no tiene receta estándar en esa variante');
        }
        return reconstruirRecetaBoton(tx, boton, variante);
      }
      const lineas = body.lineas.map(l => ({ categoria: String(l.categoria), cantidad: decimal(l.cantidad) }));
      const error = errorReceta(variante, lineas);
      if (error) throw new BadRequestException(error);
      const categorias = await categoriasMaquina(tx, idMaquina);
      const sinTolva = lineas.filter(l => !categorias.has(l.categoria)).map(l => nombreCategoria(l.categoria));
      if (sinTolva.length) {
        throw new BadRequestException(`La máquina no tiene tolva de: ${sinTolva.join(', ')}. Agrégala en Insumos o quítala de la receta.`);
      }
      const estandar = (await tx.recetasEstandar.findMany({ where: { idProdTerm: boton.idProdTerm, varianteCafe: variante } }))
        .map(e => ({ categoria: e.categoriaInsumo, cantidad: e.cantidadDosis }));
      await tx.recetaBoton.deleteMany({ where: { idMapaNrq, categoriaInsumo: { notIn: lineas.map(l => l.categoria) } } });
      for (const l of lineas) {
        const personalizada = esPersonalizada(l.categoria, l.cantidad, estandar);
        await tx.recetaBoton.upsert({
          where: { idMapaNrq_categoriaInsumo: { idMapaNrq, categoriaInsumo: l.categoria } },
          update: { cantidadDosis: l.cantidad, personalizada, fechaActualizacion: new Date() },
          create: { idMapaNrq, categoriaInsumo: l.categoria, cantidadDosis: l.cantidad, personalizada },
        });
      }
      await tx.mapaCafeNrq.update({ where: { idMapaNrq }, data: { varianteCafe: variante } });
      return { variante, lineas: lineas.length, personalizada: lineas.some(l => esPersonalizada(l.categoria, l.cantidad, estandar)) };
    });
  }

  /** Cambia la dosis de un insumo en todos los botones de la máquina que lo usan. */
  async ajustarInsumo(idMaquina: number, categoria: string, cantidad: number | string, idUsuario?: number | null) {
    if (!esCategoriaInsumo(categoria)) throw new BadRequestException('Categoría de insumo inválida');
    const valor = decimal(cantidad);
    if (valor.lte(0)) throw new BadRequestException('La dosis debe ser mayor que 0');
    return this.prisma.$transaction(async tx => {
      await contextoAuditoria(tx, idUsuario);
      const lineas = await tx.recetaBoton.findMany({
        where: { categoriaInsumo: categoria, boton: { idMaquina } },
        include: { boton: { select: { idProdTerm: true, varianteCafe: true } } },
      });
      for (const l of lineas) {
        const estandar = await tx.recetasEstandar.findMany({
          where: { idProdTerm: l.boton.idProdTerm, varianteCafe: l.boton.varianteCafe ?? '' },
        });
        await tx.recetaBoton.update({
          where: { idRecetaBoton: l.idRecetaBoton },
          data: { cantidadDosis: valor, fechaActualizacion: new Date(), personalizada: esPersonalizada(categoria, valor,
            estandar.map(e => ({ categoria: e.categoriaInsumo, cantidad: e.cantidadDosis }))) },
        });
      }
      return { botonesAjustados: lineas.length };
    });
  }

  /** Restaura desde la estándar la receta de todos los botones de la máquina. */
  async restaurarMaquina(idMaquina: number, idUsuario?: number | null) {
    return this.prisma.$transaction(async tx => {
      await contextoAuditoria(tx, idUsuario);
      const botones = await tx.mapaCafeNrq.findMany({ where: { idMaquina } });
      for (const b of botones) await reconstruirRecetaBoton(tx, b, esVarianteCafe(b.varianteCafe) ? b.varianteCafe : null);
      return { botones: botones.length };
    });
  }

  // ===================== Control entre cortes =====================

  /** Suma por categoría el control de insumos guardado en cada visita del período. */
  async controlPeriodo(idMaquina: number, fechaInicio?: string, fechaFin?: string) {
    const { desde, hasta } = rangoColombia(fechaInicio, fechaFin);
    const ventas = await this.prisma.ventasPorVisita.findMany({
      where: { idMaquina, visita: { estado: { not: 'ANULADA' } },
        fechaVisita: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } },
      select: { idGrupo: true, fechaVisita: true, detalle: true },
      orderBy: { fechaVisita: 'asc' },
    });
    const totales = new Map<string, {
      categoria: string; nombre: string; unidad: string; teorico: number; real: number; costos: number[];
      visitas: number; incompletas: number;
    }>();
    for (const v of ventas) {
      const controles: any[] = Array.isArray((v.detalle as any)?.controlesMP) ? (v.detalle as any).controlesMP : [];
      for (const c of controles) {
        if (!c?.categoria) continue;
        const t = totales.get(c.categoria) ?? {
          categoria: c.categoria, nombre: nombreCategoria(c.categoria), unidad: unidadCategoria(c.categoria),
          teorico: 0, real: 0, costos: [] as number[], visitas: 0, incompletas: 0,
        };
        t.visitas += 1;
        if (c.consumoTeorico == null || c.consumoReal == null) t.incompletas += 1;
        else {
          t.teorico += Number(c.consumoTeorico);
          t.real += Number(c.consumoReal);
          if (c.costoUnitario != null) t.costos.push(Number(c.costoUnitario));
        }
        totales.set(c.categoria, t);
      }
    }
    // En el período las diferencias de cada visita se compensan: se valora la neta.
    const categorias = [...totales.values()].map(({ costos, ...t }) => {
      const diferencia = t.real - t.teorico;
      const costo = costos.length ? costos.reduce((a, c) => a + c, 0) / costos.length : 0;
      return { ...t, diferencia, valorDiferencia: Math.round(Math.abs(diferencia) * costo * 100) / 100 };
    });
    return { visitas: ventas.length, categorias, valorDiferenciaTotal: categorias.reduce((a, c) => a + c.valorDiferencia, 0) };
  }
}

export type { VarianteCafe };
