import { Prisma } from '@prisma/client';

export async function baseEspirales(tx: Prisma.TransactionClient, idVisita?: number, hasta = new Date()) {
  if (idVisita == null) return [];
  const pedidos = await tx.pedidosOperador.findMany({
    where: { idGrupo: idVisita, idMapaMp: { not: null }, nrqActualLectura: null, nrActualMedido: { not: null } },
    select: {
      idMapaMp: true, idProducto: true, fisicoDigitado: true,
      despachosBodega: { where: { fechaHora: { lte: hasta } }, select: { cantDespachada: true } },
    },
    orderBy: { idPedido: 'asc' },
  });
  return pedidos.map(({ despachosBodega, ...p }) => ({
    ...p, despachado: despachosBodega.reduce((total, d) => total + d.cantDespachada, 0),
  }));
}

export async function ultimasLecturas(tx: Prisma.TransactionClient, idMaquina: number) {
  const [visita, efectivo, botones, mapas] = await Promise.all([
    tx.visitas.findFirst({
      where: { idMaquina, estado: { not: 'ANULADA' } },
      orderBy: [{ fechaVisita: 'desc' }, { idVisita: 'desc' }],
    }),
    tx.visitas.findFirst({
      where: { idMaquina, estado: { not: 'ANULADA' }, nrEfectivoActual: { not: null } },
      orderBy: [{ fechaVisita: 'desc' }, { idVisita: 'desc' }],
      select: { nrEfectivoActual: true },
    }),
    tx.mapaCafeNrq.findMany({
      where: { idMaquina },
      orderBy: { opcionBoton: 'asc' },
      select: {
        idMapaNrq: true, lecturaInicial: true,
        lecturas: {
          where: { visita: { idMaquina, estado: { not: 'ANULADA' } } },
          orderBy: [{ visita: { fechaVisita: 'desc' } }, { idVisita: 'desc' }],
          select: { lecturaActual: true }, take: 1,
        },
      },
    }),
    tx.mapaMateriaPrima.findMany({
      where: { idMaquina, producto: { tipoProducto: 'ESTANDAR' }, maquina: { tipoNegociacion: 'ESPECIAL' } },
      orderBy: { espiralCodigo: 'asc' },
      select: { idMapaMp: true, idProducto: true, lecturaInicial: true, lecturasNrq: {
        where: { visita: { idMaquina, estado: { not: 'ANULADA' } } },
        orderBy: [{ visita: { fechaVisita: 'desc' } }, { idVisita: 'desc' }],
        select: { idVisita: true, idProdTerm: true, lecturaActual: true }, take: 1,
      } },
    }),
  ]);
  return {
    visita,
    nrEfectivo: efectivo?.nrEfectivoActual ?? 0n,
    botones: botones.map(b => ({
      idMapaNrq: b.idMapaNrq,
      lectura: b.lecturas[0]?.lecturaActual ?? b.lecturaInicial,
    })),
    nrqEspirales: mapas.map(m => ({
      idMapaMp: m.idMapaMp,
      idVisita: m.lecturasNrq[0]?.idVisita ?? null,
      idProductoAnterior: m.lecturasNrq[0]?.idProdTerm ?? null,
      lectura: m.lecturasNrq[0]?.lecturaActual ?? m.lecturaInicial,
    })),
  };
}
