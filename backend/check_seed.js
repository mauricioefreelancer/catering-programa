const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    console.log('Conectando a PostgreSQL...');
    const u = await p.usuariosSistema.count();
    const r = await p.rolesPerfiles.count();
    const prod = await p.productos.count();
    const rec = await p.recetasDosificados.count();
    const cli = await p.clientes.count();
    const prov = await p.proveedores.count();

    console.log('=== CANTIDAD DE DATOS EN BD ===');
    console.log('  ROLES PERFILES      :', r);
    console.log('  USUARIOS SISTEMA    :', u);
    console.log('  CLIENTES            :', cli);
    console.log('  PROVEEDORES         :', prov);
    console.log('  PRODUCTOS           :', prod);
    console.log('  RECETAS DOSIFICADOS :', rec);
    console.log('==============================');

    if (r > 0) {
      const roles = await p.rolesPerfiles.findMany({ select: { ID_Rol: true, Nombre_Rol: true } });
      console.log('\nRoles creados:');
      roles.forEach(x => console.log('  • ID', x.ID_Rol, '-', x.Nombre_Rol));
    }
    if (u > 0) {
      const admins = await p.usuariosSistema.findMany({
        take: 3, select: { ID_Usuario: true, Email: true, Nombre_Completo: true, ID_Rol: true, Estado: true }
      });
      console.log('\nUsuarios muestra:');
      admins.forEach(x => console.log('  •', x.Email, '-', x.Nombre_Completo, '(Rol ID=', x.ID_Rol, ', Estado=', x.Estado, ')'));
    }
    if (prod > 0) {
      const productos = await p.productos.findMany({ take: 5, select: { ID_Producto: true, Nombre: true, Tipo_Producto: true, Costo_Base: true, Costo_Total: true } });
      console.log('\nProductos muestra:');
      productos.forEach(x => console.log('  • ID', x.ID_Producto, '-', x.Nombre, '-', x.Tipo_Producto, '- $', x.Costo_Total));
    }
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
