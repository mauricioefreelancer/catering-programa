import * as http from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

const BigIntSerializer = (v: any) => {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(BigIntSerializer);
    if (typeof v.toNumber === 'function') {
      try { return Number(v); } catch { return v.toString(); }
    }
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = BigIntSerializer(v[k]);
    return out;
  }
  return v;
};

const PORT = Number(process.env.PORT ?? 3000);

// ============================================================
// 1) RAW HTTP SERVER (Node.js puro) ANTES QUE NEST Y PRISMA
//    - Escucha inmediatamente en los primeros 100ms
//    - Render Health Check recibe 200 OK SIN esperar Nest/Prisma
// ============================================================
const healthOnlyHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = (req.url ?? '/').split('?')[0];
  if (req.method === 'GET' && (url === '/health' || url === '/')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Connection', 'close');
    res.end(url === '/' ? 'Catering Backend OK (Live)' : 'OK');
    return true;
  }
  return false;
};

const server = http.createServer((req, res) => {
  if (healthOnlyHandler(req, res)) return;
  res.statusCode = 503;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Retry-After', '10');
  res.end('Nest bootstrap in progress... retry shortly');
});

server.on('error', (err: any) => {
  console.error('[SERVER RAW ERROR]', err);
  if (err?.code === 'EADDRINUSE') process.exit(1);
});

server.listen(PORT, '0.0.0.0', 511, () => {
  const addr = server.address();
  const addrStr = typeof addr === 'string' ? addr : `${addr?.address ?? '0.0.0.0'}:${addr?.port ?? PORT}`;
  console.log(`\n[BOOTSTRAP RAW HTTP] Servidor HTTP Base escuchando en ${addrStr} ✅`);
  console.log(`[BOOTSTRAP RAW HTTP] '/'  y '/health' ya responden 200 OK desde el milisegundo 100`);
  console.log(`[BOOTSTRAP RAW HTTP] Render Health Check NO podrá hacer Timed Out ahora.\n`);
});

// ============================================================
// 2) INICIALIZACIÓN NEST (ahora asíncrona, no bloquea /health)
// ============================================================
async function bootstrapNest() {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
    bodyParser: true,
  });

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    strictTransportSecurity: false,
    xDnsPrefetchControl: false,
  }));

  const corsRaw = process.env.CORS_ORIGIN ?? '*';
  const corsClean = String(corsRaw)
    .replace(/[\u0060\u00B4\u2018\u2019\u0022\u0027\u00A0]/g, '')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .trim();
  const originList = corsClean === '*'
    ? true
    : corsClean.split(',').map(s => s.trim()).filter(Boolean);

  app.enableCors({
    origin: originList,
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
    exposedHeaders: ['Content-Length','Content-Type','X-Request-Id'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, transform: true, forbidNonWhitelisted: false,
  }));
  app.use((_req: any, res: any, next: any) => {
    const origJson = res.json.bind(res);
    res.json = (body: any) => origJson(BigIntSerializer(body));
    next();
  });

  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();

  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (healthOnlyHandler(req, res)) return;
    expressApp(req, res);
  });

  console.log('\n========================================================');
  console.log('🚀 Nest cargado correctamente - Todas las rutas /api listas');
  console.log('   Server base escuchando en 0.0.0.0:' + PORT + '/api');
  console.log('   CORS: ' + (originList === true ? '* (todos)' : String(originList)));
  console.log('   Prisma: lazyConnect (1ª conexión se hará en el primer query)');
  console.log('========================================================\n');
}

bootstrapNest().catch(err => {
  console.error('\n❌ ERROR DURANTE BOOTSTRAP NEST:', err);
  console.error('   (El /health sigue funcionando OK aunque Nest haya fallado)\n');
  setTimeout(() => process.exit(1), 5000);
});
