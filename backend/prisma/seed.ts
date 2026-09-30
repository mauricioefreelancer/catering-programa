import { PrismaClient, RolesPerfiles } from '@prisma/client';
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
  console.log('🌱 Iniciando seed...');

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

  console.log('✅ 6 Roles creados: Desarrollador, Bodega, Tesorería, Operador, Megacuadro');

  const desarrolladorPassword = await bcrypt.hash('Admin123*', 10);
  const adminPassword = desarrolladorPassword;
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
  console.log('✅ Usuario Desarrollador creado (admin@example.com / Admin123*)');

  const jefeUsuario = await prisma.usuariosSistema.upsert({
    where: { email: 'jefe@example.com' },
    update: { passwordHash: adminPassword },
    create: {
      idRol: megacuadroRol.idRol,
      nombreCompleto: 'Jefe / Gerente General',
      usuarioLogin: 'jefe',
      email: 'jefe@example.com',
      passwordHash: adminPassword,
    },
  });
  console.log('✅ Usuario Jefe Megacuadro creado (jefe@example.com / Admin123*)');

  const bodegaUsuario = await prisma.usuariosSistema.upsert({
    where: { email: 'bodega@example.com' },
    update: { passwordHash: adminPassword },
    create: {
      idRol: bodegaRol.idRol,
      nombreCompleto: 'Carlos Bodeguero',
      usuarioLogin: 'bodega1',
      email: 'bodega@example.com',
      passwordHash: adminPassword,
    },
  });
  console.log('✅ Usuario Bodega creado (bodega@example.com / Admin123*)');

  const tesoreriaUsuario = await prisma.usuariosSistema.upsert({
    where: { email: 'tesoreria@example.com' },
    update: { passwordHash: adminPassword },
    create: {
      idRol: tesoreriaRol.idRol,
      nombreCompleto: 'Ana Tesorera',
      usuarioLogin: 'tesoreria1',
      email: 'tesoreria@example.com',
      passwordHash: adminPassword,
    },
  });
  console.log('✅ Usuario Tesorería creado (tesoreria@example.com / Admin123*)');

  const proveedorDemo = await prisma.proveedores.upsert({
    where: { nit: '900.000.000-1' },
    update: {},
    create: {
      nit: '900.000.000-1',
      razonSocial: 'Proveedor Demo SAS',
      asesorNombre: 'Carlos Proveedor',
      asesorTelefono: '3001234567',
      asesorCorreo: 'carlos@proveedordemo.com',
    },
  });
  console.log('✅ Proveedor demo creado');

  const productoEstandar = await prisma.productos.upsert({
    where: { codigoBarras: '7701001' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7701001',
      nombreProducto: 'Chocolatina',
      tipoProducto: 'ESTANDAR',
      stockActual: 100,
      stockMin: 20,
      stockMax: 200,
      costoBase: 1500,
      costoTotal: 1500,
    },
  });

  const materiaPrima = await prisma.productos.upsert({
    where: { codigoBarras: '7702001' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702001',
      nombreProducto: 'Café Molido Kilo',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Kilo',
      unidadConsumo: 'Gramo',
      equivalencia: 1000,
      costoBase: 50000,
      costoTotal: 50000,
      stockMin: 5,
      stockMax: 50,
      stockActual: 10,
    },
  });

  const materiaPrima2Vasos = await prisma.productos.upsert({
    where: { codigoBarras: '7702002' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702002',
      nombreProducto: 'Vaso Desechable 12oz (Paquete 30und)',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Paquete',
      unidadConsumo: 'Unidad',
      equivalencia: 30,
      costoBase: 4500,
      costoTotal: 4500,
      stockMin: 10,
      stockMax: 200,
      stockActual: 50,
    },
  });

  const materiaPrima3Leche = await prisma.productos.upsert({
    where: { codigoBarras: '7702003' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702003',
      nombreProducto: 'Leche UHT Entera (Caja 1000ml)',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Caja',
      unidadConsumo: 'Mililitro',
      equivalencia: 1000,
      costoBase: 6000,
      costoTotal: 6000,
      stockMin: 10,
      stockMax: 120,
      stockActual: 40,
    },
  });

  const materiaPrima4Azucar = await prisma.productos.upsert({
    where: { codigoBarras: '7702004' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702004',
      nombreProducto: 'Azúcar Refinada (Bolsa 1000g)',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Bolsa',
      unidadConsumo: 'Gramo',
      equivalencia: 1000,
      costoBase: 3200,
      costoTotal: 3200,
      stockMin: 10,
      stockMax: 150,
      stockActual: 60,
    },
  });

  const materiaPrima5Chocolate = await prisma.productos.upsert({
    where: { codigoBarras: '7702005' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702005',
      nombreProducto: 'Chocolate en Polvo (Bolsa 500g)',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Bolsa',
      unidadConsumo: 'Gramo',
      equivalencia: 500,
      costoBase: 11000,
      costoTotal: 11000,
      stockMin: 5,
      stockMax: 60,
      stockActual: 20,
    },
  });

  const materiaPrima6Cafe500g = await prisma.productos.upsert({
    where: { codigoBarras: '7702006' },
    update: {},
    create: {
      idProveedor: proveedorDemo.idProveedor,
      codigoBarras: '7702006',
      nombreProducto: 'Café Molido (Bolsa 500g)',
      tipoProducto: 'MATERIA_PRIMA',
      unidadCompra: 'Bolsa',
      unidadConsumo: 'Gramo',
      equivalencia: 500,
      costoBase: 27000,
      costoTotal: 27000,
      stockMin: 10,
      stockMax: 100,
      stockActual: 25,
    },
  });

  const productoDosificado = await prisma.productos.upsert({
    where: { codigoBarras: '7703001' },
    update: {},
    create: {
      codigoBarras: '7703001',
      nombreProducto: 'Café Negro 12oz',
      tipoProducto: 'DOSIFICADO',
      stockMin: 0,
      stockMax: 0,
      stockActual: 0,
    },
  });

  const productoDosificado2 = await prisma.productos.upsert({
    where: { codigoBarras: '7703002' },
    update: {},
    create: {
      codigoBarras: '7703002',
      nombreProducto: 'Café con Leche 12oz',
      tipoProducto: 'DOSIFICADO',
      stockMin: 0,
      stockMax: 0,
      stockActual: 0,
    },
  });

  const productoDosificado3 = await prisma.productos.upsert({
    where: { codigoBarras: '7703003' },
    update: {},
    create: {
      codigoBarras: '7703003',
      nombreProducto: 'Chocolate Caliente 12oz',
      tipoProducto: 'DOSIFICADO',
      stockMin: 0,
      stockMax: 0,
      stockActual: 0,
    },
  });
  console.log('✅ Productos demo creados (3 ESTANDAR/MP base + 5 MP adicionales + 3 DOSIFICADO)');

  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado.idProducto,
        idMatPrima: materiaPrima6Cafe500g.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado.idProducto,
      idMatPrima: materiaPrima6Cafe500g.idProducto,
      cantidadDosis: 7,
      unidadDosis: 'Gramo',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado.idProducto,
        idMatPrima: materiaPrima2Vasos.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado.idProducto,
      idMatPrima: materiaPrima2Vasos.idProducto,
      cantidadDosis: 1,
      unidadDosis: 'Unidad',
    },
  });

  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado2.idProducto,
        idMatPrima: materiaPrima6Cafe500g.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado2.idProducto,
      idMatPrima: materiaPrima6Cafe500g.idProducto,
      cantidadDosis: 6,
      unidadDosis: 'Gramo',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado2.idProducto,
        idMatPrima: materiaPrima3Leche.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado2.idProducto,
      idMatPrima: materiaPrima3Leche.idProducto,
      cantidadDosis: 100,
      unidadDosis: 'Mililitro',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado2.idProducto,
        idMatPrima: materiaPrima2Vasos.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado2.idProducto,
      idMatPrima: materiaPrima2Vasos.idProducto,
      cantidadDosis: 1,
      unidadDosis: 'Unidad',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado2.idProducto,
        idMatPrima: materiaPrima4Azucar.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado2.idProducto,
      idMatPrima: materiaPrima4Azucar.idProducto,
      cantidadDosis: 5,
      unidadDosis: 'Gramo',
    },
  });

  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado3.idProducto,
        idMatPrima: materiaPrima5Chocolate.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado3.idProducto,
      idMatPrima: materiaPrima5Chocolate.idProducto,
      cantidadDosis: 15,
      unidadDosis: 'Gramo',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado3.idProducto,
        idMatPrima: materiaPrima3Leche.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado3.idProducto,
      idMatPrima: materiaPrima3Leche.idProducto,
      cantidadDosis: 80,
      unidadDosis: 'Mililitro',
    },
  });
  await prisma.recetasDosificados.upsert({
    where: {
      idProdTerm_idMatPrima: {
        idProdTerm: productoDosificado3.idProducto,
        idMatPrima: materiaPrima2Vasos.idProducto,
      },
    },
    update: {},
    create: {
      idProdTerm: productoDosificado3.idProducto,
      idMatPrima: materiaPrima2Vasos.idProducto,
      cantidadDosis: 1,
      unidadDosis: 'Unidad',
    },
  });
  console.log('✅ 9 Recetas dosificados creadas (Café Negro 2, Café con Leche 4, Chocolate 3)');

  const clienteDemo = await prisma.clientes.upsert({
    where: { nit: '900.123.456-7' },
    update: {},
    create: {
      nit: '900.123.456-7',
      razonSocial: 'Empresa Demo S.A.S.',
      contactoNombre: 'María Cliente',
      contactoTelefono: '3109876543',
      contactoCorreo: 'maria@empresademo.com',
      contactoDireccion: 'Calle 123 # 45-67, Bogotá',
      contactoCiudad: 'Bogotá',
      fechaContrato: new Date(),
    },
  });
  console.log('✅ Cliente demo creado');

  const operadorPassword = await bcrypt.hash('Operador123*', 10);

  const operadorUsuario1 = await prisma.usuariosSistema.upsert({
    where: { email: 'operador1@example.com' },
    update: {
      passwordHash: operadorPassword,
    },
    create: {
      idRol: operadorRol.idRol,
      nombreCompleto: 'Juan Pérez (Operador 1 · Zona Norte)',
      usuarioLogin: 'operador1',
      email: 'operador1@example.com',
      passwordHash: operadorPassword,
    },
  });
  await prisma.operadores.upsert({
    where: { idUsuario: operadorUsuario1.idUsuario },
    update: {},
    create: {
      idUsuario: operadorUsuario1.idUsuario,
      nombreCompleto: 'Juan Pérez (Operador 1 · Zona Norte)',
      telefono: '3151112233',
      zonaAsignada: 'Zona Norte',
      fechaIngreso: new Date('2025-01-15'),
    },
  });

  const operadorUsuario2 = await prisma.usuariosSistema.upsert({
    where: { email: 'operador2@example.com' },
    update: {
      passwordHash: operadorPassword,
    },
    create: {
      idRol: operadorRol.idRol,
      nombreCompleto: 'Pedro Gómez (Operador 2 · Zona Sur)',
      usuarioLogin: 'operador2',
      email: 'operador2@example.com',
      passwordHash: operadorPassword,
    },
  });
  await prisma.operadores.upsert({
    where: { idUsuario: operadorUsuario2.idUsuario },
    update: {},
    create: {
      idUsuario: operadorUsuario2.idUsuario,
      nombreCompleto: 'Pedro Gómez (Operador 2 · Zona Sur)',
      telefono: '3152223344',
      zonaAsignada: 'Zona Sur',
      fechaIngreso: new Date('2025-03-01'),
    },
  });

  const operadorUsuario3 = await prisma.usuariosSistema.upsert({
    where: { email: 'operador3@example.com' },
    update: {
      passwordHash: operadorPassword,
    },
    create: {
      idRol: operadorRol.idRol,
      nombreCompleto: 'Luisa Martínez (Operador 3 · Zona Centro)',
      usuarioLogin: 'operador3',
      email: 'operador3@example.com',
      passwordHash: operadorPassword,
    },
  });
  await prisma.operadores.upsert({
    where: { idUsuario: operadorUsuario3.idUsuario },
    update: {},
    create: {
      idUsuario: operadorUsuario3.idUsuario,
      nombreCompleto: 'Luisa Martínez (Operador 3 · Zona Centro)',
      telefono: '3153334455',
      zonaAsignada: 'Zona Centro',
      fechaIngreso: new Date('2025-05-20'),
    },
  });
  console.log('✅ 3 Operadores creados (Zonas: Norte / Sur / Centro) · Contraseña común: Operador123*');

  const op1 = await prisma.operadores.findUnique({ where: { idUsuario: operadorUsuario1.idUsuario } });
  const op2 = await prisma.operadores.findUnique({ where: { idUsuario: operadorUsuario2.idUsuario } });
  const op3 = await prisma.operadores.findUnique({ where: { idUsuario: operadorUsuario3.idUsuario } });

  const maquinasData = [
    { serial: 'CAFE-DEMO-001', tipo: 'CAFE',      idOperador: op1?.idOperador || 1, ubicacion: 'Edificio Central · Piso 3 · Cafetería Norte', clienteNit: clienteDemo.nit },
    { serial: 'SNACK-DEMO-001', tipo: 'SNACKS',    idOperador: op1?.idOperador || 1, ubicacion: 'Sede Norte · Lobby Recepcion ZN',          clienteNit: clienteDemo.nit },
    { serial: 'CAFE-DEMO-002', tipo: 'CAFE',      idOperador: op2?.idOperador || 2, ubicacion: 'C.C. Santa Fe · Comida Rápida ZS',        clienteNit: clienteDemo.nit },
    { serial: 'SNACK-DEMO-002', tipo: 'SNACKS',    idOperador: op2?.idOperador || 2, ubicacion: 'Oficinas Sur · Piso 1 ZS',               clienteNit: clienteDemo.nit },
    { serial: 'CAFE-DEMO-003', tipo: 'CAFE',      idOperador: op3?.idOperador || 3, ubicacion: 'Universidad Central · Cafetería ZC',     clienteNit: clienteDemo.nit },
    { serial: 'SNACK-DEMO-003', tipo: 'COMBINADA', idOperador: op3?.idOperador || 3, ubicacion: 'Hospital Zonal · Lobby ZC',              clienteNit: clienteDemo.nit },
  ];
  for (const md of maquinasData) {
    await prisma.maquinasYTiendas.upsert({
      where: { serial: md.serial },
      update: {
        idOperador: md.idOperador,
        tipo: md.tipo,
        ubicacionEsp: md.ubicacion,
        idCliente: clienteDemo.idCliente,
      },
      create: {
        serial: md.serial,
        marca: 'Catering Demo',
        tipo: md.tipo,
        ubicacionEsp: md.ubicacion,
        idOperador: md.idOperador,
        idCliente: clienteDemo.idCliente,
        fechaInstalacion: new Date('2025-06-01'),
      },
    });
  }
  console.log('✅ 6 Máquinas creadas (2 por Operador): 3 CAFE + 3 SNACK/BEBIDA/COMBINADA · Cliente = Empresa Demo');

  const cafeNegro = await prisma.productos.findUnique({ where: { codigoBarras: '7703001' } });
  const cafeConLeche = await prisma.productos.findUnique({ where: { codigoBarras: '7703002' } });
  const chocolate = await prisma.productos.findUnique({ where: { codigoBarras: '7703003' } });
  const maqsCafe = (await prisma.maquinasYTiendas.findMany({ where: { tipo: 'CAFE' } }));
  for (const mc of maqsCafe) {
    if (cafeNegro) {
      await prisma.mapaCafeNrq.upsert({
        where: { idMaquina_opcionBoton: { idMaquina: mc.idMaquina, opcionBoton: 'B1' } },
        update: {},
        create: { idMaquina: mc.idMaquina, opcionBoton: 'B1', idProdTerm: cafeNegro.idProducto },
      });
    }
    if (cafeConLeche) {
      await prisma.mapaCafeNrq.upsert({
        where: { idMaquina_opcionBoton: { idMaquina: mc.idMaquina, opcionBoton: 'B2' } },
        update: {},
        create: { idMaquina: mc.idMaquina, opcionBoton: 'B2', idProdTerm: cafeConLeche.idProducto },
      });
    }
    if (chocolate) {
      await prisma.mapaCafeNrq.upsert({
        where: { idMaquina_opcionBoton: { idMaquina: mc.idMaquina, opcionBoton: 'B3' } },
        update: {},
        create: { idMaquina: mc.idMaquina, opcionBoton: 'B3', idProdTerm: chocolate.idProducto },
      });
    }
  }
  console.log('✅ Mapa Café NRQ asignado a las 3 máquinas CAFE (B1 Negro · B2 C/L · B3 Chocolate) · Inventario Mobile funcional para Op1/Op2/Op3');

  console.log('🌱 Seed finalizado exitosamente!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
