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
  console.log('🌱 Iniciando seed PERFILES COMPLETOS (post-TRUNCATE v4, perfiles intactos)...');
  console.log('⏭️  SOLO se generan: 5 roles + 7 usuarios. Nada demo.');

  const desarrolladorRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Desarrollador' }, update: {},
    create: { nombreRol: 'Desarrollador', permisosCrud: ALL_PERMISSIONS as any },
  });
  const bodegaRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Bodega' }, update: {},
    create: { nombreRol: 'Bodega', permisosCrud: BODEGA_PERMISSIONS as any },
  });
  const tesoreriaRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Tesorería' }, update: {},
    create: { nombreRol: 'Tesorería', permisosCrud: TESORERIA_PERMISSIONS as any },
  });
  const operadorRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Operador' }, update: {},
    create: { nombreRol: 'Operador', permisosCrud: OPERADOR_PERMISSIONS as any },
  });
  const megacuadroRol = await prisma.rolesPerfiles.upsert({
    where: { nombreRol: 'Megacuadro' }, update: {},
    create: { nombreRol: 'Megacuadro', permisosCrud: MEGACUADRO_PERMISSIONS as any },
  });
  console.log('✅ 5 Roles creados: Desarrollador, Bodega, Tesorería, Operador, Megacuadro');

  const adminPassword = await bcrypt.hash('Admin123*', 10);
  const operadorPassword = await bcrypt.hash('Operador123*', 10);

  await prisma.usuariosSistema.upsert({
    where: { email: 'admin@example.com' },
    update: { idRol: desarrolladorRol.idRol, nombreCompleto: 'Desarrollador ERP', passwordHash: adminPassword },
    create: { idRol: desarrolladorRol.idRol, nombreCompleto: 'Desarrollador ERP', usuarioLogin: 'desarrollador', email: 'admin@example.com', passwordHash: adminPassword },
  });
  console.log('✅ [1/7] Admin Desarrollador: admin@example.com / Admin123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'jefe@example.com' },
    update: { idRol: megacuadroRol.idRol, nombreCompleto: 'Jefe / Gerente General', passwordHash: adminPassword },
    create: { idRol: megacuadroRol.idRol, nombreCompleto: 'Jefe / Gerente General', usuarioLogin: 'jefe', email: 'jefe@example.com', passwordHash: adminPassword },
  });
  console.log('✅ [2/7] Jefe Megacuadro: jefe@example.com / Admin123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'bodega@example.com' },
    update: { idRol: bodegaRol.idRol, nombreCompleto: 'Carlos Bodeguero', passwordHash: adminPassword },
    create: { idRol: bodegaRol.idRol, nombreCompleto: 'Carlos Bodeguero', usuarioLogin: 'bodega1', email: 'bodega@example.com', passwordHash: adminPassword },
  });
  console.log('✅ [3/7] Bodega: bodega@example.com / Admin123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'tesoreria@example.com' },
    update: { idRol: tesoreriaRol.idRol, nombreCompleto: 'Ana Tesorera', passwordHash: adminPassword },
    create: { idRol: tesoreriaRol.idRol, nombreCompleto: 'Ana Tesorera', usuarioLogin: 'tesoreria1', email: 'tesoreria@example.com', passwordHash: adminPassword },
  });
  console.log('✅ [4/7] Tesorería: tesoreria@example.com / Admin123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'operador1@example.com' },
    update: { idRol: operadorRol.idRol, nombreCompleto: 'Juan Pérez (Operador 1 · Zona Norte)', passwordHash: operadorPassword },
    create: { idRol: operadorRol.idRol, nombreCompleto: 'Juan Pérez (Operador 1 · Zona Norte)', usuarioLogin: 'operador1', email: 'operador1@example.com', passwordHash: operadorPassword },
  });
  console.log('✅ [5/7] Operador 1: operador1@example.com / Operador123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'operador2@example.com' },
    update: { idRol: operadorRol.idRol, nombreCompleto: 'Pedro Gómez (Operador 2 · Zona Sur)', passwordHash: operadorPassword },
    create: { idRol: operadorRol.idRol, nombreCompleto: 'Pedro Gómez (Operador 2 · Zona Sur)', usuarioLogin: 'operador2', email: 'operador2@example.com', passwordHash: operadorPassword },
  });
  console.log('✅ [6/7] Operador 2: operador2@example.com / Operador123*');

  await prisma.usuariosSistema.upsert({
    where: { email: 'operador3@example.com' },
    update: { idRol: operadorRol.idRol, nombreCompleto: 'Luisa Martínez (Operador 3 · Zona Centro)', passwordHash: operadorPassword },
    create: { idRol: operadorRol.idRol, nombreCompleto: 'Luisa Martínez (Operador 3 · Zona Centro)', usuarioLogin: 'operador3', email: 'operador3@example.com', passwordHash: operadorPassword },
  });
  console.log('✅ [7/7] Operador 3: operador3@example.com / Operador123*');

  console.log('🌱 Seed PERFILES COMPLETOS finalizado exitosamente. 7 usuarios listos, datos operativos 0.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
