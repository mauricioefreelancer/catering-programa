import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const mutating = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method);
    const authHeader = req.headers['authorization'];
    let userId: number | null = null;
    let ip: string | undefined = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined;
    if (ip && ip.includes(':')) {
      const parts = ip.split(':');
      ip = parts[parts.length - 1];
    }

    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const payload = this.jwtService.verify(token, {
            secret: process.env.JWT_SECRET || 'cambiar_esta_clave_segura_en_produccion',
          });
          if (payload && payload.sub) {
            userId = payload.sub as number;
          }
        }
      } catch (e) {
        //
      }
    }

    if (mutating) {
      try {
        await this.prisma.setCurrentUser(userId, ip);
      } catch (e) {
        //
      }
    }

    next();
  }
}
