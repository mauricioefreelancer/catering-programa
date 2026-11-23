import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { evaluarTolerancia, ParametrosService } from './parametros.service';

describe('Tolerancia por visita', () => {
  it('invalida el cache tras editar y conserva el resultado guardado de la visita anterior', async () => {
    let valor = new Prisma.Decimal(10000);
    const findMany = jest.fn(async () => [{ clave: 'TOLERANCIA_DIF_VENTA_COP', valor }]);
    const tx = {
      $queryRaw: jest.fn(),
      parametrosSistema: { update: jest.fn(async ({ data }) => { valor = new Prisma.Decimal(data.valor); }) },
    };
    const prisma = { parametrosSistema: { findMany }, $transaction: (f: (t: typeof tx) => unknown) => f(tx) };
    const servicio = new ParametrosService(prisma as unknown as PrismaService);
    const anterior = (await servicio.tolerancias()).venta;
    const diferencia = new Prisma.Decimal(-11000);
    const visitaGuardada = { tolerancia: anterior, alerta: evaluarTolerancia(diferencia, anterior) };
    expect((await servicio.tolerancias()).venta).toBe(anterior);
    expect(findMany).toHaveBeenCalledTimes(1);
    await servicio.editar('TOLERANCIA_DIF_VENTA_COP', 15000, 1);
    expect(evaluarTolerancia(diferencia, (await servicio.tolerancias()).venta)).toBe(false);
    expect(visitaGuardada.tolerancia.toString()).toBe('10000');
    expect(visitaGuardada.alerta).toBe(true);
  });

  it('no alerta por un importe cero ni por una diferencia no evaluable', () => {
    expect(evaluarTolerancia(new Prisma.Decimal(0), new Prisma.Decimal(0))).toBe(false);
    expect(evaluarTolerancia(null, new Prisma.Decimal(0))).toBeNull();
  });
});
