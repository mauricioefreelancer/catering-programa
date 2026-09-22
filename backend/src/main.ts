import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

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
  const port = Number(process.env.PORT ?? 3000);
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
  });
  const server = app.getHttpAdapter().getHttpServer();
  const rawServer = app.getHttpAdapter().getInstance();

  rawServer.on('request', (req: any, res: any) => {
    if (req.method === 'GET' && (req.url === '/health' || req.url.startsWith('/health?'))) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.end('OK');
      return;
    }
  });

  rawServer.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  const corsOriginRaw = process.env.CORS_ORIGIN ?? '*';
  const corsOrigin = corsOriginRaw.replace(/`/g, '').trim();
  const originList = corsOrigin === '*'
    ? true
    : corsOrigin.split(',').map((s: string) => s.trim()).filter(Boolean);

  app.enableCors({
    origin: originList,
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
    maxAge: 86400,
  });

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

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend corriendo en http://0.0.0.0:${port}/api (CORS=${corsOrigin}) [server.listening=${server.listening}]`);
  const realPort = (server.address() as any)?.port;
  if (realPort) console.log(`ℹ️ Server bound on port=${realPort}`);
}
bootstrap().catch((err: unknown) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
