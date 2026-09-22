import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      errorFormat: 'minimal',
      log: ['warn','error'],
      __internal: {
        lazyConnect: true,
      } as any,
    });
  }

  async ensureConnected() {
    try {
      await this.$connect();
    } catch (err) {
      console.error('[Prisma] Error al intentar conectar (lazy):', err);
      throw err;
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
