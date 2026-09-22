import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

const BigIntSerializer = (v: any) => {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(BigIntSerializer);
    if (typeof v.toNumber === 'function') {
      try { return Number(v); } catch { return v.toString(); }
    }
    const out: any = {};
    for (const k of Object.keys(v)) {
      out[k] = BigIntSerializer(v[k]);
    }
    return out;
  }
  return v;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
  });
  app.use(helmet());
  app.enableCors({ origin: '*', credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.use((_req: any, res: any, next: any) => {
    const origJson = res.json.bind(res);
    res.json = (body: any) => origJson(BigIntSerializer(body));
    next();
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend corriendo en http://localhost:${port}/api`);
}
bootstrap();
