import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const VENTA = 'TOLERANCIA_DIF_VENTA_COP';
const MP = 'TOLERANCIA_DIF_MP_COP';
type Tolerancias = { venta: Prisma.Decimal; mp: Prisma.Decimal };

export function evaluarTolerancia(diferencia: Prisma.Decimal | null, tolerancia: Prisma.Decimal) {
  return diferencia == null ? null : !diferencia.isZero() && diferencia.abs().gte(tolerancia);
}

@Injectable()
export class ParametrosService {
  private cache?: { hasta: number; valores: Tolerancias };
  private revision = 0;

  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.parametrosSistema.findMany({ orderBy: { clave: 'asc' } });
  }

  async tolerancias(): Promise<Tolerancias> {
    if (this.cache && this.cache.hasta > Date.now()) return this.cache.valores;
    const revision = this.revision;
    const filas = await this.listar();
    const valor = (clave: string) => filas.find(f => f.clave === clave)?.valor ?? new Prisma.Decimal(10000);
    const valores = { venta: valor(VENTA), mp: valor(MP) };
    if (revision === this.revision) this.cache = { hasta: Date.now() + 60000, valores };
    return valores;
  }

  async editar(clave: string, valor: number, idUsuario: number) {
    if (clave !== VENTA && clave !== MP) throw new NotFoundException('Parámetro no encontrado');
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > Number.MAX_SAFE_INTEGER ||
        new Prisma.Decimal(valor).decimalPlaces() > 2) throw new BadRequestException('Indica un número no negativo con hasta dos decimales');
    const fila = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('app.current_user_id', ${String(idUsuario)}, TRUE)`;
      return tx.parametrosSistema.update({ where: { clave }, data: { valor, idUsuarioActualiza: idUsuario } });
    });
    this.revision += 1;
    this.cache = undefined;
    return fila;
  }
}
