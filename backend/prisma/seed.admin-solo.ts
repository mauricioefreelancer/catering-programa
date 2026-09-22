import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = {
  clientes: { ver: true, crear: true, editar: true, eliminar: true },
  proveedores: { ver: true, crear: true, editar: true, eliminar: true },
  operadores: { ver: true, crear: true, editar: true, eliminar: true },
  productos: { ver: true, crear: true, editar: true, eliminar: true },
  preciosCliente: { ver: true, crear: true, editar: true, eliminar: true },
  precios: { ver: true, crear: true, editar: true, eliminar: true },
  maquinas: { ver: true, crear: true, editar: true, eliminar: true },
  inventario: { ver: true, crear: true, editar: true, eliminar: true },
  pedidosOperador: { ver: true, crear: true, editar: true, eliminar: true },
  despachos: { ver: true, crear: true, editar: true, eliminar: true },
  tesoreria: { ver: true, crear: true, editar: true, eliminar: true },
  admin: { ver: true, crear: true, editar: true, eliminar: true },
  dashboard: { ver: true, crear: false, editar: false, eliminar: false },
  megacuadro: { ver: true, crear: false, editar: false, eliminar: false },
};

const BODEGA_PERMISSIONS = {
  clientes: { ver: true, crear: false, editar: false, eliminar: false },
  proveedores: { ver: true, crear: true, editar: true, eliminar: false },
  operadores: { ver: true, crear: false, editar: false, eliminar: false },
  productos: { ver: true, crear: true, editar: true, eliminar: false },
  preciosCliente: { ver: true, crear: false, editar: false, eliminar: false },
  precios: { ver: true, crear: false, editar: false, eliminar: false },
  maquinas: { ver: true, crear: true, editar: true, eliminar: false },
  inventario: { ver: true, crear: true, editar: true, eliminar: false },
  pedidosOperador: { ver: true, crear: false, editar: false, eliminar: false },
  despachos: { ver: true, crear: true, editar: true, eliminar: false },
  tesoreria: { ver: false, crear: false, editar: false, eliminar: false },
  admin: { ver: false, crear: false, editar: false, eliminar: false },
  dashboard: { ver: true, crear: false, editar: false, eliminar: false },
  megacuadro: { ver: false, crear: false, editar: false, eliminar: false },
};

const TESORERIA_PERMISSIONS = {
  clientes: { ver: true, crear: false, editar: false, eliminar: false },
  proveedores: { ver: true, crear: false, editar: false, eliminar: false },
  operadores: { ver: true, crear: false, editar: false, eliminar: false },
  productos: { ver: true, crear: false, editar: false, eliminar: false },
  preciosCliente: { ver: true, crear: true, editar: true, eliminar: false },
  precios: { ver: true, crear: true, editar: true, eliminar: false },
  maquinas: { ver: true, crear: false, editar: false, eliminar: false },
  inventario: { ver: true, crear: false, editar: false, eliminar: false },
  pedidosOperador: { ver: true, crear: false, editar: false, eliminar: false },
  despachos: { ver: true, crear: false, editar: false, eliminar: false },
  tesoreria: { ver: true, crear: true, editar: true, eliminar: false },
  admin: { ver: false, crear: false, editar: false, eliminar: false },
  dashboard: { ver: true, crear: false, editar: false, eliminar: false },
  megacuadro: { ver: false, crear: false, editar: false, eliminar: false },
};

const OPERADOR_PERMISSIONS = {
  clientes: { ver: true, crear: false, editar: false, eliminar: false },
  proveedores: { ver: false, crear: false, editar: false, eliminar: false },
  operadores: { ver: false, crear: false, editar: false, eliminar: false },
  productos: { ver: true, crear: false, editar: false, eliminar: false },
  preciosCliente: { ver: false, crear: false, editar: false, eliminar: false },
  precios: { ver: false, crear: false, editar: false, eliminar: false },
  maquinas: { ver: true, crear: false, editar: false, eliminar: false },
  inventario: { ver: false, crear: false, editar: false, eliminar: false },
  pedidosOperador: { ver: true, crear: true, editar: true, eliminar: false },
  despachos: { ver: true, crear: false, editar: false, eliminar: false },
  tesoreria: { ver: false, crear: false, editar: false, eliminar: false },
  admin: { ver: false, crear: false, editar: false, eliminar: false },
  dashboard: { ver: false, crear: false, editar: false, eliminar: false },
  megacuadro: { ver: false, crear: false, editar: false, eliminar: false },
};

const MEGACUADRO_PERMISSIONS = {
  clientes: { ver: true, crear: false, editar: false, eliminar: false },
  proveedores: { ver: true, crear: false, editar: false, eliminar: false },
  operadores: { ver: true, crear: false, editar: false, eliminar: false },
  productos: { ver: true, crear: false, editar: false, eliminar: false },
  preciosCliente: { ver: true, crear: false, editar: false, eliminar: false },
  precios: { ver: true, crear: false, editar: false, eliminar: false },
  maquinas: { ver: true, crear: false, editar: false, eliminar: false },
  inventario: { ver: true, crear: false, editar: false, eliminar: false },
  pedidosOperador: { ver: true, crear: false, editar: false, eliminar: false },
  despachos: { ver: true, crear: false, editar: false, eliminar: false },
  tesoreria: { ver: true, crear: false, editar: false, eliminar: false },
  admin: { ver: false, crear: false, editar: false, eliminar: false },
  dashboard: { ver: true, crear: false, editar: false, eliminar: false },
  megacuadro: { ver: true, crear: false, editar: false, eliminar: false },
};

async function main() {
  console.log('🌱 Iniciando seed LIMPIO post-TRUNCATE...');
  console.log('⏭️  Datos demo deshabilitados: SOLO roles + Admin único.');

  const desarrolladorRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Desarrollador' },
    update: {},
    create: {
      nombreRol: 'Desarrollador',
      permisosCrud: ALL_PERMISSIONS as any,
    },
  });

  const bodegaRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Bodega' },
    update: {},
    create: {
      nombreRol: 'Bodega',
      permisosCrud: BODEGA_PERMISSIONS as any,
    },
  });

  const tesoreriaRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Tesorería' },
    update: {},
    create: {
      nombreRol: 'Tesorería',
      permisosCrud: TESORERIA_PERMISSIONS as any,
    },
  });

  const operadorRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Operador' },
    update: {},
    create: {
      nombreRol: 'Operador',
      permisosCrud: OPERADOR_PERMISSIONS as any,
    },
  });

  const megacuadroRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Megacuadro' },
    update: {},
    create: {
      nombreRol: 'Megacuadro',
      permisosCrud: MEGACUADRO_PERMISSIONS as any,
    },
  });

  console.log('✅ 5 Roles creados: Desarrollador, Bodega, Tesorería, Operador, Megacuadro');

  const desarrolladorPassword = await bcrypt.hash('Admin123*', 10);
  const desarrolladorUsuario = await prisma.usuariosSistema.upsert({
    where: { email: 'admin@example.com' },
    update: {
      idRol: desarrolladorRol.idRol,
      nombreCompleto: 'Desarrollador ERP',
      passwordHash: desarrolladorPassword,
    },
    create: {
      idRol: desarrolladorRol.idRol,
      nombreCompleto: 'Desarrollador ERP',
      usuarioLogin: 'desarrollador',
      email: 'admin@example.com',
      passwordHash: desarrolladorPassword,
    },
  });

  console.log('✅ USUARIO ADMIN SEMILLA CREADO (post-Limpieza):');
  console.log('     Email:    admin@example.com');
  console.log('     Nombre:   Desarrollador ERP');
  console.log('     Rol:      Desarrollador (ALL_PERMISSIONS)');
  console.log('     Password: Admin123*');

  console.log('🌱 Seed LIMPIO finalizado exitosamente!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
