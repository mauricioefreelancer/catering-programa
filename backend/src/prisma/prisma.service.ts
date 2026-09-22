import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      errorFormat: 'minimal',
      log: ['warn','error'],
    });
  }

  async onModuleInit() {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          clearTimeout(t);
          reject(new Error('Prisma $connect timeout (>10s) - skipping, will lazy connect on 1st query'));
        }, 10000);
      });
      await Promise.race([ this.$connect(), timeoutPromise ]);
      console.log('[Prisma] onModuleInit: Conexion exitosa (lazy-race 10s) ✅');
    } catch (err) {
      console.warn('[Prisma] onModuleInit: No se conecto en 10s o error. Se conectara en la primera consulta. Detalle:', err instanceof Error ? err.message : String(err));
    }
  }

  async setCurrentUser(userId: number | null, ip?: string | null) {
    const uid = userId ? String(userId) : '';
    const ipStr = ip || '';
    await this.$executeRawUnsafe(`SELECT set_config('app.current_user_id', '${uid}', TRUE)`);
    if (ipStr) {
      await this.$executeRawUnsafe(`SELECT set_config('app.client_ip', '${ipStr}', TRUE)`);
    }
  }
}
