#!/usr/bin/env node
/**
 * Limpieza única de la base durante la fase de construcción.
 *
 * Conserva solo USUARIOS_SISTEMA, ROLES_PERFILES, PARAMETROS_SISTEMA y el historial
 * de migraciones; vacía todas las demás tablas y reinicia sus secuencias.
 * Crea el perfil y el usuario administrador "Engenitix" con todos los permisos y
 * elimina el usuario demo admin@example.com.
 *
 * Uso (en la consola o un job de Render):
 *   CONFIRMAR_RESET=BORRAR-DATOS-DE-PRUEBA ADMIN_CLAVE_INICIAL=... node scripts/reset-datos-prueba.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { verificarEntorno } = require('./verificar-entorno');

const CONSERVAR = ['USUARIOS_SISTEMA', 'ROLES_PERFILES', 'PARAMETROS_SISTEMA', '_prisma_migrations'];
const MODULOS = [
  'admin', 'precios', 'clientes', 'maquinas', 'dashboard', 'despachos', 'productos', 'tesoreria',
  'inventario', 'megacuadro', 'operadores', 'proveedores', 'preciosCliente', 'pedidosOperador',
];
const ADMIN = { rol: 'Engenitix', login: 'Engenitix', nombre: 'Engenitix', email: 'engenitix@erp.local' };
const DEMO_EMAIL = 'admin@example.com';

async function main() {
  if (process.env.CONFIRMAR_RESET !== 'BORRAR-DATOS-DE-PRUEBA') {
    throw new Error('Define CONFIRMAR_RESET=BORRAR-DATOS-DE-PRUEBA para ejecutar la limpieza');
  }
  const clave = process.env.ADMIN_CLAVE_INICIAL;
  if (!clave || clave.length < 8) throw new Error('Define ADMIN_CLAVE_INICIAL (mínimo 8 caracteres)');
  const entorno = verificarEntorno();
  if (!entorno.ok) throw new Error('Entorno no permitido: ' + JSON.stringify(entorno.remotos));

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(clave, 10);
    const permisos = Object.fromEntries(MODULOS.map(m => [m, { ver: true, crear: true, editar: true, eliminar: true }]));
    const resumen = await prisma.$transaction(async tx => {
      const tablas = await tx.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
      const vaciar = tablas.map(t => t.tablename).filter(t => !CONSERVAR.includes(t));
      const conteos = {};
      for (const t of vaciar) {
        const [{ n }] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t.replace(/"/g, '""')}"`);
        conteos[t] = n;
      }
      // Sin CASCADE: si una tabla conservada dependiera de una vaciada, falla en vez de borrarla.
      await tx.$executeRawUnsafe(
        `TRUNCATE TABLE ${vaciar.map(t => `"${t.replace(/"/g, '""')}"`).join(', ')} RESTART IDENTITY`);

      const rol = await tx.rolesPerfiles.upsert({
        where: { nombreRol: ADMIN.rol },
        update: { permisosCrud: permisos, estado: true },
        create: { nombreRol: ADMIN.rol, permisosCrud: permisos, estado: true },
      });
      const existente = await tx.usuariosSistema.findFirst({
        where: { OR: [{ usuarioLogin: ADMIN.login }, { email: ADMIN.email }] },
      });
      const admin = existente
        ? await tx.usuariosSistema.update({ where: { idUsuario: existente.idUsuario },
          data: { idRol: rol.idRol, passwordHash: hash, estado: true, permisosExcepcion: null } })
        : await tx.usuariosSistema.create({ data: {
          idRol: rol.idRol, nombreCompleto: ADMIN.nombre, usuarioLogin: ADMIN.login, email: ADMIN.email,
          passwordHash: hash, estado: true } });

      const demo = await tx.usuariosSistema.findUnique({ where: { email: DEMO_EMAIL } });
      if (demo) {
        await tx.parametrosSistema.updateMany({ where: { idUsuarioActualiza: demo.idUsuario }, data: { idUsuarioActualiza: null } });
        await tx.usuariosSistema.delete({ where: { idUsuario: demo.idUsuario } });
      }
      return { vaciadas: conteos, rol: rol.idRol, admin: admin.idUsuario, demoEliminado: !!demo };
    }, { timeout: 120000, maxWait: 30000 });
    console.log(JSON.stringify(resumen, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('LIMPIEZA ABORTADA:', error.message);
  process.exit(1);
});
