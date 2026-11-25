#!/usr/bin/env node
/**
 * Protege la base de producción: aborta si NODE_ENV no es "production" y
 * DATABASE_URL o DIRECT_URL apuntan a un host distinto de localhost.
 *
 * Se usa antes de los scripts manuales de migración y carga de datos
 * (npm run db:migrate, npm run db:seed, prisma db seed). No se usa en el
 * Pre-Deploy de Render, que corre con NODE_ENV=production.
 */
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function hostDe(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return '(URL inválida)';
  }
}

function verificarEntorno(env = process.env) {
  if (env.NODE_ENV === 'production') return { ok: true };
  const remotos = ['DATABASE_URL', 'DIRECT_URL']
    .map((variable) => ({ variable, host: hostDe(env[variable]) }))
    .filter(({ host }) => host != null && !HOSTS_LOCALES.has(host));
  return remotos.length ? { ok: false, remotos } : { ok: true };
}

module.exports = { verificarEntorno };

if (require.main === module) {
  const resultado = verificarEntorno();
  if (!resultado.ok) {
    console.error('ABORTADO: NODE_ENV no es "production" y la base no es local.');
    for (const { variable, host } of resultado.remotos) console.error(`  ${variable} apunta a ${host}`);
    console.error('Las migraciones de Render solo las aplica su Pre-Deploy.');
    process.exit(1);
  }
}
