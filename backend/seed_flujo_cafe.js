/* ==========================================================================
   SCRIPT EJEMPLO PRÁCTICO: FLUJO MÁQUINA DE CAFÉ (SQL RAW)
   Compra por BOLSAS / PAQUETES  →  Receta por GRAMOS / UNIDADES
   ========================================================================== */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n || 0));
const sql = (q) => p.$queryRawUnsafe(q);
const sql1 = async (q) => (await p.$queryRawUnsafe(q))[0];
const exec = (q) => p.$executeRawUnsafe(q);

async function main() {
  console.log('\n===============================================================');
  console.log('   🌱 SEED FLUJO EJEMPLO · MÁQUINA CAFÉ (SQL)');
  console.log('   (Compra por BOLSAS vs Consumo por GRAMOS/Unidades)');
  console.log('===============================================================\n');

  // ======= 0. IDs base ====================================================
  console.log('🔎 Buscando entidades base ...');
  const adminUser = await sql1(`SELECT "ID_Usuario", "Nombre_Completo" FROM "USUARIOS_SISTEMA" ORDER BY "ID_Usuario" LIMIT 1`);
  const cli = await sql1(`SELECT "ID_Cliente", "Razon_Social" FROM "CLIENTES" ORDER BY "ID_Cliente" LIMIT 1`);
  const prov = await sql1(`SELECT "ID_Proveedor", "Razon_Social" FROM "PROVEEDORES" ORDER BY "ID_Proveedor" LIMIT 1`);
  const op  = await sql1(`SELECT "ID_Operador", "Nombre_Completo", "Zona_Asignada" FROM "OPERADORES" ORDER BY "ID_Operador" LIMIT 1`);
  const ID_U = adminUser.ID_Usuario;
  const ID_C = cli.ID_Cliente;
  const ID_P = prov.ID_Proveedor;
  const ID_O = op.ID_Operador;
  console.log('   ✔ AdminUser:', ID_U, adminUser.Nombre_Completo);
  console.log('   ✔ Cliente  :', ID_C, cli.Razon_Social);
  console.log('   ✔ Proveedor:', ID_P, prov.Razon_Social);
  console.log('   ✔ Operador :', ID_O, op.Nombre_Completo, op.Zona_Asignada);

  // ======= 1. PRODUCTOS MATERIA PRIMA =====================================
  console.log('\n📦 Productos Materia Prima ...');
  const findProd = (cod) => sql1(`SELECT * FROM "PRODUCTOS" WHERE "Codigo_Barras" = '${cod}'`);

  let pCafe = await findProd('7702001');
  if (!pCafe) await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'7702001','Café Molido · Bolsa Kilo','MATERIA_PRIMA','Bolsa 1 Kilo','Gramo',1000,55000,0,55000,2,6,0)`);
  pCafe = await findProd('7702001'); console.log('   ☕ Café Kilo       ID=' + pCafe.ID_Producto + ' · ' + Number(pCafe.Equivalencia) + 'g/Bolsa · Costo ' + fmt(Number(pCafe.Costo_Base)));

  let pLeche = await findProd('7702002');
  if (!pLeche) await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'7702002','Leche en Polvo · Paquete 250g','MATERIA_PRIMA','Paquete 250g','Gramo',250,12000,0,12000,1,4,0)`);
  pLeche = await findProd('7702002'); console.log('   🥛 Leche Polvo    ID=' + pLeche.ID_Producto + ' · ' + Number(pLeche.Equivalencia) + 'g/Paq · Costo ' + fmt(Number(pLeche.Costo_Base)));

  let pVaso = await findProd('7702003');
  if (!pVaso) await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'7702003','Vaso Desechable 12oz · Paq x100','MATERIA_PRIMA','Paquete 100','Unidad',100,15000,19,17850,3,10,0)`);
  pVaso = await findProd('7702003'); console.log('   🥤 Vaso 12oz     ID=' + pVaso.ID_Producto + ' · ' + Number(pVaso.Equivalencia) + 'und/Paq · Costo ' + fmt(Number(pVaso.Costo_Total)));

  let pAzucar = await findProd('7702004');
  if (!pAzucar) await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'7702004','Azúcar · Paquete 500g','MATERIA_PRIMA','Paquete 500g','Gramo',500,4000,0,4000,2,6,0)`);
  pAzucar = await findProd('7702004'); console.log('   🍚 Azúcar        ID=' + pAzucar.ID_Producto + ' · ' + Number(pAzucar.Equivalencia) + 'g/Paq · Costo ' + fmt(Number(pAzucar.Costo_Base)));

  // Producto DOSIFICADO (Café Negro)
  let pNegro = await findProd('7703001');
  if (!pNegro) await exec(`INSERT INTO "PRODUCTOS" ("ID_Proveedor","Codigo_Barras","Nombre_Producto","Tipo_Producto","Unidad_Compra","Unidad_Consumo","Equivalencia","Costo_Base","Porcentaje_Imp","Costo_Total","Stock_Min","Stock_Max","Stock_Actual") VALUES (${ID_P},'7703001','Café Negro 12oz','DOSIFICADO','Vaso','Unidad',1,0,0,0,50,200,0)`);
  pNegro = await findProd('7703001'); console.log('   ☕ Café Negro    ID=' + pNegro.ID_Producto + ' (Producto DOSIFICADO)');

  // ======= 2. RECETA ======================================================
  console.log('\n🧪 Receta Café Negro (ingredientes/taza) ...');
  const ingRec = [
    { mp: pCafe,   dosis: 7, label: 'Café Molido' },
    { mp: pLeche,  dosis: 5, label: 'Leche Polvo' },
    { mp: pAzucar, dosis: 3, label: 'Azúcar' },
    { mp: pVaso,   dosis: 1, label: 'Vaso + Tapa' },
  ];
  for (const ing of ingRec) {
    const ex = await sql1(`SELECT "ID_Receta" FROM "RECETAS_DOSIFICADOS" WHERE "ID_Prod_Term"=${pNegro.ID_Producto} AND "ID_Mat_Prima"=${ing.mp.ID_Producto}`);
    if (!ex) await exec(`INSERT INTO "RECETAS_DOSIFICADOS" ("ID_Prod_Term","ID_Mat_Prima","Cantidad_Dosis","Unidad_Dosis") VALUES (${pNegro.ID_Producto},${ing.mp.ID_Producto},${ing.dosis},'${ing.mp.Unidad_Consumo}')`);
    const r = await sql1(`SELECT * FROM "RECETAS_DOSIFICADOS" WHERE "ID_Prod_Term"=${pNegro.ID_Producto} AND "ID_Mat_Prima"=${ing.mp.ID_Producto}`);
    console.log(
      '     • ' + r.Cantidad_Dosis.toString().padStart(2) + ' ' + (r.Unidad_Dosis || '').padEnd(7) +
      ' ' + ing.label.padEnd(16) + '  → Costo_Proporcional = ' + fmt(Number(r.Costo_Proporcional)),
    );
  }
  // Recargar producto para que trigger SQL calcule costo total
  await exec(`UPDATE "PRODUCTOS" SET "Costo_Base" = "Costo_Base" WHERE "ID_Producto" = ${pNegro.ID_Producto}`);
  pNegro = await findProd('7703001');
  console.log('     ─────────────────────────────────────────────────');
  console.log('     ✅ Costo_Base PRODUCTO DOSIFICADO (Auto by Trigger SQL): ' + fmt(Number(pNegro.Costo_Base)));
  console.log('     ✅ Costo_Total PRODUCTO DOSIFICADO (Auto by Trigger SQL): ' + fmt(Number(pNegro.Costo_Total)));

  // ======= 3. INGRESO A BODEGA (COMPRA) ====================================
  console.log('\n📥 Ingreso a Bodega Principal · Compra por empaques ...');
  const compra = [
    { prod: pCafe,   bolsas: 5, costoUnit: 55000, vence: `'2027-06-30'::date` },
    { prod: pLeche,  bolsas: 10, costoUnit: 12000, vence: `'2026-12-31'::date` },
    { prod: pVaso,   bolsas: 5, costoUnit: 17850, vence: `'2028-12-31'::date` },
    { prod: pAzucar, bolsas: 4, costoUnit: 4000, vence: `'2026-11-30'::date` },
  ];
  const idIng = (await sql1(`INSERT INTO "INGRESOS_BODEGA" ("ID_Proveedor","ID_Usuario","Factura_Num","Observaciones") VALUES (${ID_P},${ID_U},'FAC-DEMO-0001','Compra Flujo Café · Prueba') RETURNING "ID_Ingreso";`)).ID_Ingreso;
  console.log('   ✔ Ingreso #' + idIng + ' · Factura FAC-DEMO-0001');
  let inversion = 0;
  for (const d of compra) {
    const idDet = (await sql1(`INSERT INTO "DETALLE_INGRESOS" ("ID_Ingreso","ID_Producto","Cantidad_Recib","Costo_Unitario_Compra","Fecha_Venc") VALUES (${idIng},${d.prod.ID_Producto},${d.bolsas},${d.costoUnit},${d.vence}) RETURNING "ID_Det_Ingreso";`)).ID_Det_Ingreso;
    await exec(`UPDATE "PRODUCTOS" SET "Stock_Actual" = "Stock_Actual" + ${d.bolsas} WHERE "ID_Producto" = ${d.prod.ID_Producto}`);
    inversion += d.bolsas * d.costoUnit;
    console.log('     • Det #' + idDet + '  ' + d.bolsas.toString().padStart(2) + ' ' + d.prod.Unidad_Compra.padEnd(16) + '  ' + fmt(d.bolsas * d.costoUnit));
  }
  console.log('     ─────────────────────────────────────────────────');
  console.log('     INVERSIÓN TOTAL BODEGA: ' + fmt(inversion));

  // ======= 4. MÁQUINA CAFÉ + MAPAS ========================================
  console.log('\n🖥️  Máquina CAFE-DEMO-001 tipo CAFÉ ...');
  let mq = await sql1(`SELECT * FROM "MAQUINAS_Y_TIENDAS" WHERE "Serial" = 'CAFE-DEMO-001'`);
  if (!mq) mq = await sql1(`INSERT INTO "MAQUINAS_Y_TIENDAS" ("ID_Cliente","ID_Operador","Serial","Marca","Tipo","Ubicacion_Esp","Medios_Pago") VALUES (${ID_C},${ID_O},'CAFE-DEMO-001','Nescafé Gold','CAFE','Edificio · Piso 3 Cafetería','["Efectivo","Datáfono","Veos","Nequi"]'::jsonb) RETURNING *;`);
  console.log('   ✔ Máquina ID=' + mq.ID_Maquina + ' · ' + mq.Serial + ' · ' + mq.Marca);

  const mapaMPData = [
    { esp: 'A1', p: pCafe,   cap: 3, label: 'Café Kilo' },
    { esp: 'A2', p: pLeche,  cap: 2, label: 'Leche Polvo' },
    { esp: 'A3', p: pVaso,   cap: 2, label: 'Vaso 12oz' },
    { esp: 'A4', p: pAzucar, cap: 2, label: 'Azúcar' },
  ];
  for (const m of mapaMPData) {
    const ex = await sql1(`SELECT "ID_Mapa_MP" FROM "MAPA_MATERIA_PRIMA" WHERE "ID_Maquina"=${mq.ID_Maquina} AND "Espiral_Codigo"='${m.esp}'`);
    if (!ex) await exec(`INSERT INTO "MAPA_MATERIA_PRIMA" ("ID_Maquina","ID_Producto","Espiral_Codigo","Capacidad_Max") VALUES (${mq.ID_Maquina},${m.p.ID_Producto},'${m.esp}',${m.cap})`);
    console.log('     ✔ Mapa MP ' + m.esp.padEnd(3) + ' ' + m.label.padEnd(14) + ' Capacidad=' + m.cap + ' empaques');
  }

  let nrq = await sql1(`SELECT "ID_Mapa_NRQ" FROM "MAPA_CAFE_NRQ" WHERE "ID_Maquina"=${mq.ID_Maquina} AND "Opcion_Boton"='B1'`);
  if (!nrq) nrq = await sql1(`INSERT INTO "MAPA_CAFE_NRQ" ("ID_Maquina","ID_Prod_Term","Opcion_Boton") VALUES (${mq.ID_Maquina},${pNegro.ID_Producto},'B1') RETURNING "ID_Mapa_NRQ";`);
  console.log('     ✔ Mapa NRQ B1  → Café Negro (Producto Dosificado)');

  // Precio Cliente
  const pc = await sql1(`SELECT "ID_Precio" FROM "PRECIOS_CLIENTE" WHERE "ID_Cliente"=${ID_C} AND "ID_Producto"=${pNegro.ID_Producto}`);
  if (!pc) await exec(`INSERT INTO "PRECIOS_CLIENTE" ("ID_Cliente","ID_Producto","Precio_Venta","Margen_Actual","Aumento_IPC") VALUES (${ID_C},${pNegro.ID_Producto},2500,35,0)`);
  console.log('     ✔ Precio Cliente (' + cli.Razon_Social + '): ' + fmt(2500) + '/taza');

  // ======= 5. PEDIDO OPERADOR (Inventario Físico Campo) ===================
  console.log('\n🧑‍🔧 Operador · Inventario físico en campo (digitado por Juan Pérez) ...');
  const fisico = [
    { esp: 'A1', p: pCafe,   fis: 0, cap: 3 },
    { esp: 'A2', p: pLeche,  fis: 0, cap: 2 },
    { esp: 'A3', p: pVaso,   fis: 1, cap: 2 },
    { esp: 'A4', p: pAzucar, fis: 0, cap: 2 },
  ];
  await exec(`DELETE FROM "PEDIDOS_OPERADOR" WHERE "ID_Maquina" = ${mq.ID_Maquina} AND "Fecha_Hora" >= (NOW() - INTERVAL '1 hour')`);
  let totalSug = 0;
  for (const f of fisico) {
    const sug = Math.max(0, f.cap - f.fis);
    totalSug += sug;
    await exec(`INSERT INTO "PEDIDOS_OPERADOR" ("ID_Maquina","ID_Operador","ID_Producto","Fisico_Digitado","Cant_Sugerida") VALUES (${mq.ID_Maquina},${ID_O},${f.p.ID_Producto},${f.fis},${sug})`);
    console.log(
      '     Espiral ' + f.esp + '  Físico=' + f.fis + '  Capacidad=' + f.cap +
      '  →  Pedido Sugerido = ' + sug + ' empaques ' + f.p.Nombre_Producto.substring(0, 24),
    );
  }
  console.log('     ─────────────────────────────────────────────────');
  console.log('     Total Pedido Sugerido (INFORMATIVO · NO resta stock): ' + totalSug + ' empaques');

  // ======= 6. TESORERÍA EJEMPLO CUADRE ====================================
  console.log('\n💵 Tesorería · Cuadre ejemplo ...');
  await exec(`DELETE FROM "TESORERIA_EFECTIVO_NR" WHERE "ID_Maquina"=${mq.ID_Maquina} AND "NR_Anterior"=1420`);
  let tc = await sql1(`INSERT INTO "TESORERIA_EFECTIVO_NR" ("ID_Maquina","ID_Operador","ID_Usuario","NR_Anterior","NR_Actual","Diferencia_NR","Efectivo_Teorico","Efectivo_Recog","Diferencia_Rec") VALUES (${mq.ID_Maquina},${ID_O},${ID_U},1420,1580,160,400000,398000,-2000) RETURNING *;`);
  tc.NR_Anterior = Number(tc.NR_Anterior); tc.NR_Actual = Number(tc.NR_Actual); tc.Diferencia_NR = Number(tc.Diferencia_NR);
  tc.Efectivo_Teorico = Number(tc.Efectivo_Teorico); tc.Efectivo_Recog = Number(tc.Efectivo_Recog); tc.Diferencia_Rec = Number(tc.Diferencia_Rec);
  console.log(
    '     NR Anterior=' + fmtN(tc.NR_Anterior) + '  NR Actual=' + fmtN(tc.NR_Actual) +
    '  →  Dif_NR = ' + fmtN(tc.Diferencia_NR) + ' tazas = ' + fmt(Number(tc.Efectivo_Teorico)) + ' Teórico',
  );
  console.log(
    '     Efectivo Recogido: ' + fmt(Number(tc.Efectivo_Recog)) +
    '  →  DIFERENCIA RECAUDO: ' + (Number(tc.Diferencia_Rec) < 0 ? '❌ FALTANTE ' : '✅ SOBRANTE ') + fmt(Number(tc.Diferencia_Rec)),
  );

  // ======= 7. RESUMEN DIDÁCTICO ===========================================
  const costoTaza = Number(pNegro.Costo_Base) || Number(pNegro.Costo_Total) || 0;
  const precVenta = 2500;
  const utilidad = precVenta - costoTaza;
  const tazasXBolsa = 1000 / 7;

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  📖 RESUMEN DIDÁCTICO: BOLSAS → GRAMOS → TAZAS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  🏬 BODEGA PRINCIPAL compra en EMPAQUES GRANDES:');
  for (const d of compra) {
    console.log('     • ' + d.bolsas.toString().padStart(2) + ' ' + d.prod.Unidad_Compra.padEnd(18) + ' ' + fmt(d.bolsas * d.costoUnit));
  }
  console.log('     ───────────────────────────────────────────────────');
  console.log('     INVERSIÓN TOTAL BODEGA:  ' + fmt(inversion));
  console.log('');
  console.log('  🧪 1 TAZA CAFÉ NEGRO (Producto DOSIFICADO) consume FRACCIONES:');
  for (const ing of ingRec) {
    const costoUnit = Number(ing.mp.Costo_Base) / Number(ing.mp.Equivalencia);
    console.log('     • ' + ing.dosis.toString().padStart(2) + ' ' + String(ing.mp.Unidad_Consumo).padEnd(7) + ' ' + ing.label.padEnd(17) + ' $' + Math.round(costoUnit * ing.dosis));
  }
  console.log('     ───────────────────────────────────────────────────');
  console.log('     COSTO / TAZA (calculado en TRIGGER SQL nativo):  ' + fmt(costoTaza));
  console.log('     PRECIO VENTA CLIENTE:                             ' + fmt(precVenta) + '/taza');
  console.log('     UTILIDAD NETA POR TAZA:                           ' + fmt(utilidad) + ' (' + Math.round((utilidad/precVenta)*100) + '%)');
  console.log('');
  console.log('  🔁 RENDIMIENTO 1 BOLSA CAFÉ = 1 KILO = 1.000 gramos:');
  console.log('     1.000 g ÷ 7 g / taza = ' + fmtN(tazasXBolsa) + ' tazas por bolsa');
  console.log('     × ' + fmt(utilidad) + ' utilidad / taza = ' + fmt(tazasXBolsa * utilidad) + ' GANANCIA x Bolsa');
  console.log('');
  console.log('  🚚 OPERADOR digita por BOLSAS (Mapa MP espirales):');
  fisico.forEach((f) => {
    const sug = Math.max(0, f.cap - f.fis);
    console.log('     Espiral ' + f.esp + '  Físico=' + f.fis + ' / ' + f.cap + '  →  Pedido: ' + sug + ' empaques ' + f.p.Nombre_Producto.substring(0,22));
  });
  console.log('');
  console.log('  🛡️  6 REGLAS CLAVE DEL MODELO LOGÍSTICO:');
  console.log('     1️⃣  Stock Bodega = UNIDAD DE COMPRA (Bolsa/Kilo/Paquete)');
  console.log('     2️⃣  Operador NO pide en gramos, pide en EMPAQUES');
  console.log('     3️⃣  Pedido Sugerido = INFORMATIVO, NO resta stock');
  console.log('     4️⃣  Solo BODEGA al APROBAR DESPACHO = Stock -= min(Sugerido, Stock)');
  console.log('     5️⃣  Faltante = Pendiente_Desp (queda en memoria próxima compra)');
  console.log('     6️⃣  Facturación NRQ: (NRQ Final - NRQ Inicial) × Precio Matriz Cliente');
  console.log('');
  console.log('  ⚙️  TRIGGERS NATIVOS EN POSTGRESQL (0% consumo backend):');
  console.log('     • Ingreso/Update Materia Prima → Auto Costo_Proporcional Receta');
  console.log('     • Update Costo_Proporcional → Auto Costo_Base Producto DOSIFICADO');
  console.log('     • Cualquier CUD → AUDITORIA_LOG inalterable');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🎉 FLUJO CAFÉ COMPLETO CARGADO A LA BD');
  console.log('👉 En el ERP prueba:');
  console.log('   • Máquinas → CAFE-DEMO-001 → Mapa MP / Mapa NRQ');
  console.log('   • Ingresos Bodega → factura FAC-DEMO-0001');
  console.log('   • Productos → Café Negro 12oz → Tab Recetas (ver Costo_Proporcional)');
  console.log('   • Despachos → Pedidos Pendientes (ver pedidos del operador)');
  console.log('   • Tesorería → Cuadres y Facturación NRQ');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ ERROR:', e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
