import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
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
