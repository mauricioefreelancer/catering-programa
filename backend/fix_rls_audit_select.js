const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    console.log('[1] Verificar RLS en AUDITORIA_LOG...');
    const rls = await prisma.$queryRawUnsafe(`
      SELECT relrowsecurity AS rls_on, relforcerowsecurity AS rls_forced
      FROM pg_class WHERE relname = 'AUDITORIA_LOG' AND relkind = 'r'`);
    console.log('    ', JSON.stringify(rls));

    console.log('[2] Crear POLICY SELECT global AUDITORIA_LOG si no existe...');
    await prisma.$queryRawUnsafe(`DROP POLICY IF EXISTS audit_log_select_all ON "AUDITORIA_LOG"`);
    await prisma.$queryRawUnsafe(`CREATE POLICY audit_log_select_all ON "AUDITORIA_LOG" FOR SELECT USING (true)`);
    console.log('    OK: policy audit_log_select_all creada');

    console.log('[3] Prueba SELECT COUNT post-fix...');
    const cnt = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS c FROM "AUDITORIA_LOG"`);
    console.log('    rows =', Number(cnt[0].c));

    console.log('[4] Prueba SELECT 5 filas para confirmar JSONB Detalle_Cambios OK...');
    const rows = await prisma.$queryRawUnsafe(`SELECT "ID_Log","Accion","Tabla_Afectada","Detalle_Cambios" FROM "AUDITORIA_LOG" LIMIT 5`);
    for (const r of rows) {
      console.log(`    ID=${r.ID_Log} ${r.Accion} ${r.Tabla_Afectada} Detalle=${typeof r.Detalle_Cambios} ${JSON.stringify(r.Detalle_Cambios).slice(0,120)}`);
    }
    console.log('\n✅ FIX APLICADO EXITOSAMENTE');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
