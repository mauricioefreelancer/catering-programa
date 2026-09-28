/* ==========================================================================
   PARAMETRIZACIÓN INTERNA: PRODUCTOS DOSIFICADOS BASE (MÁQUINA CAFÉ)
   + RECETAS usando las Materias Primas existentes en producción.
   No se crean por la UI (regla del proyecto); se insertan via SQL.
   Se crean también MP complementarias (Leche, Azúcar, Vaso) si no existen.
   Signed: prefijo de código 7702xxx para MP complementarias y 7703xxx para
   dosificados, para identificación y posible limpieza posterior.
   ========================================================================== */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const sql1 = async (q) => (await p.$queryRawUnsafe(q))[0];
const exec = (q) => p.$executeRawUnsafe(q);

async function main() {
  console.log('=== PARAMETRIZACIÓN DOSIFICADOS BASE (CAFÉ) ===\n');

  // Proveedor por defecto para las MP complementarias (usamos el 1º de producción)
  const provDef = await sql1(`SELECT "ID_Proveedor" FROM "PROVEEDORES" ORDER BY "ID_Proveedor" LIMIT 1`);
  const ID_P = provDef.ID_Proveedor;

  // ---- MP complementarias (leche, azúcar, vaso, etc.) ------------------ 
  const findProd = (cod) => sql1(`SELECT * FROM "PRODUCTOS" WHERE "Codigo_Barras"='${cod}'`);
  const upsertMP = async (cod, nombre, unidadCompra, unidadConsumo, equiv, costoBase, imp = 0) => {
    let prod = await findProd(cod);
    if (!prod) {
      const costoTotal = Math.round(costoBase * (1 + imp));
      await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'${cod}','${nombre}','MATERIA_PRIMA','${unidadCompra}','${unidadConsumo}',${equiv},${costoBase},${imp},${costoTotal},1,5,0)`);
      prod = await findProd(cod);
      console.log(`  + MP: ${nombre} (${cod})`);
    }
    return prod;
  };

  const pLeche = await upsertMP('7702010', 'Leche en Polvo · Bolsa 1kg', 'Bolsa 1kg', 'Gramo', 1000, 15000);
  const pAzucar = await upsertMP('7702011', 'Azúcar Refinada · Bolsa 500g', 'Bolsa 500g', 'Gramo', 500, 5000);
  const pVaso = await upsertMP('7702012', 'Vaso Desechable 12oz + Tapa · Paq x100', 'Paquete 100', 'Unidad', 100, 18000, 0.19);
  const pCacao = await upsertMP('7702013', 'Cacao en Polvo · Bolsa 250g', 'Bolsa 250g', 'Gramo', 250, 14000);

  // Cafés existentes en producción
  const pCafeFer = await sql1(`SELECT * FROM "PRODUCTOS" WHERE "ID_Producto"=9`);
  const pCafeEco = await sql1(`SELECT * FROM "PRODUCTOS" WHERE "ID_Producto"=10`);

  // ---- Dosificados base (matriz café) ------------------------------------
  const upsertDosif = async (cod, nombre) => {
    let prod = await findProd(cod);
    if (!prod) {
      await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'${cod}','${nombre}','DOSIFICADO','Vaso','Unidad',1,0,0,0,50,200,0)`);
      prod = await findProd(cod);
    }
    return prod;
  };

  // receta: [{mp, dosis, unidad}]
  const upsertReceta = async (idDosif, ing) => {
    for (const i of ing) {
      const ex = await sql1(`SELECT "ID_Receta" FROM "RECETAS_DOSIFICADOS" WHERE "ID_Prod_Term"=${idDosif} AND "ID_Mat_Prima"=${i.mp.ID_Producto}`);
      if (!ex) await exec(`INSERT INTO "RECETAS_DOSIFICADOS" ("ID_Prod_Term","ID_Mat_Prima","Cantidad_Dosis","Unidad_Dosis") VALUES (${idDosif},${i.mp.ID_Producto},${i.dosis},'${i.mp.Unidad_Consumo}')`);
    }
  };

  const catalogo = [
    { cod: '7703001', nombre: 'Café Negro 12oz',       receta: [ { mp: pCafeFer, dosis: 9 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703002', nombre: 'Tinto (Café Americano)', receta: [ { mp: pCafeFer, dosis: 7 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703003', nombre: 'Expresso 8oz',           receta: [ { mp: pCafeFer, dosis: 8 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703004', nombre: 'Capuccino 12oz',         receta: [ { mp: pCafeFer, dosis: 6 }, { mp: pLeche, dosis: 8 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703005', nombre: 'Leche Caliente 12oz',    receta: [ { mp: pLeche, dosis: 15 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703006', nombre: 'Chocolate Caliente 12oz',receta: [ { mp: pCacao, dosis: 12 }, { mp: pLeche, dosis: 8 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703007', nombre: 'Moca 12oz',              receta: [ { mp: pCafeFer, dosis: 6 }, { mp: pCacao, dosis: 6 }, { mp: pLeche, dosis: 8 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703008', nombre: 'Café Americano Azucarado', receta: [ { mp: pCafeFer, dosis: 7 }, { mp: pAzucar, dosis: 5 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703009', nombre: 'Latte 12oz',             receta: [ { mp: pCafeFer, dosis: 5 }, { mp: pLeche, dosis: 10 }, { mp: pVaso, dosis: 1 } ] },
    { cod: '7703010', nombre: 'Café con Leche (Perico) 12oz', receta: [ { mp: pCafeFer, dosis: 6 }, { mp: pLeche, dosis: 10 }, { mp: pVaso, dosis: 1 } ] },
  ];

  for (const d of catalogo) {
    const dosif = await upsertDosif(d.cod, d.nombre);
    await upsertReceta(dosif.ID_Producto, d.receta);
    console.log(`  ✔ Dosificado: ${d.nombre} (${d.cod}) · ${d.receta.length} ingredientes`);
  }

  // ================= MÁQUINA CAFE-DEMO-2CAFES ========================
  // Enlazar botones de la máquina demo a estos dosificados.
  const mq = await sql1(`SELECT * FROM "MAQUINAS_Y_TIENDAS" WHERE "Serial"='CAFE-DEMO-2CAFES'`);
  const btns = [ { btn: 'B1', cod: '7703001' }, { btn: 'B2', cod: '7703004' } ];
  for (const b of btns) {
    const dosif = await findProd(b.cod);
    const ex = await sql1(`SELECT "ID_Mapa_NRQ" FROM "MAPA_CAFE_NRQ" WHERE "ID_Maquina"=${mq.ID_Maquina} AND "Opcion_Boton"='${b.btn}'`);
    if (!ex) await exec(`INSERT INTO "MAPA_CAFE_NRQ" ("ID_Maquina","ID_Prod_Term","Opcion_Boton") VALUES (${mq.ID_Maquina},${dosif.ID_Producto},'${b.btn}')`);
  }

  // Precio de venta al cliente de los dosificados enlazados
  const cli = await sql1(`SELECT "ID_Cliente" FROM "CLIENTES" LIMIT 1`);
  for (const b of btns) {
    const dosif = await findProd(b.cod);
    const ex = await sql1(`SELECT "ID_Precio" FROM "PRECIOS_CLIENTE" WHERE "ID_Cliente"=${cli.ID_Cliente} AND "ID_Producto"=${dosif.ID_Producto}`);
    if (!ex) await exec(`INSERT INTO "PRECIOS_CLIENTE" ("ID_Cliente","ID_Producto","Precio_Venta","Margen_Actual") VALUES (${cli.ID_Cliente},${dosif.ID_Producto},2500,35)`);
  }
  console.log('\nMáquina', mq.Serial, '· Espiral A1:', pCafeFer.Nombre_Producto, '· A2:', pCafeEco.Nombre_Producto);
  console.log('Botones B1 (Café Negro) y B2 (Capuccino) enlazados a la máquina demo.');
}

main()
  .catch((e) => { console.error('ERROR:', e.message); })
  .finally(() => p.$disconnect());