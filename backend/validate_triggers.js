const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    console.log('✅ ==== VALIDACIÓN DATOS DEMO + TRIGGER RECETAS ====\n');

    // 1. Conteos básicos
    const r = await p.rolesPerfiles.count();
    const u = await p.usuariosSistema.count();
    const c = await p.clientes.count();
    const pr = await p.proveedores.count();
    const prod = await p.productos.count();
    const rec = await p.recetasDosificados.count();
    const op = await p.operadores.count();
    const audit = await p.auditoriaLog.count();

    console.log('📦 CANTIDAD DE DATOS:');
    console.log('   Roles       :', r);
    console.log('   Usuarios    :', u);
    console.log('   Clientes    :', c);
    console.log('   Proveedores :', pr);
    console.log('   Productos   :', prod);
    console.log('   Recetas     :', rec);
    console.log('   Operadores  :', op);
    console.log('   Auditoria   :', audit, '(registros CUD por seed - OK)\n');

    // 2. Materia Prima Café molido Kilo (código 7702001)
    const materiaPrima = await p.productos.findFirst({ where: { codigoBarras: '7702001' } });
    console.log('☕ MATERIA PRIMA (Café Kilo):');
    console.log('   Producto      :', materiaPrima.nombreProducto);
    console.log('   Equivalencia  :', Number(materiaPrima.equivalencia));
    console.log('   Costo Base    : $', Number(materiaPrima.costoBase));
    console.log('   Stock Actual  :', materiaPrima.stockActual, '\n');

    // 3. Producto DOSIFICADO (Café Negro) + Receta
    const dosificado = await p.productos.findFirst({ where: { codigoBarras: '7703001' } });
    const recetas = await p.recetasDosificados.findMany({
      where: { idProdTerm: dosificado.idProducto },
      include: { materiaPrima: true },
    });
    console.log('🥤 PRODUCTO DOSIFICADO (Café Negro 12oz):');
    console.log('   ID :', dosificado.idProducto);
    console.log('   Costo Base  (auto): $', Number(dosificado.costoBase));
    console.log('   Costo Total (auto): $', Number(dosificado.costoTotal));
    console.log('   Ingredientes (Receta):');
    let sumaTotal = 0;
    for (const ing of recetas) {
      const costoIng = Number(ing.costoProporcional);
      sumaTotal += costoIng;
      console.log(`      • ${ing.materiaPrima.nombreProducto}: ${Number(ing.cantidadDosis)} ${ing.unidadDosis} = $${costoIng}`);
    }
    console.log(`      Suma ingredientes: $${sumaTotal}`);
    console.log(`      ¿Match con Costo Base del producto? ${Math.abs(sumaTotal - Number(dosificado.costoBase)) < 0.01 ? '✅ SI (Trigger OK)' : '❌ NO'}\n`);

    // 4. PRUEBA TRIGGER: Actualizar Costo Base MP de $50.000 -> $60.000
    const costoNuevo = 60000;
    console.log(`🧪 PRUEBA TRIGGER: Actualizar café MP de $50.000 → $${costoNuevo}`);
    await p.productos.update({
      where: { idProducto: materiaPrima.idProducto },
      data: { costoBase: costoNuevo },
    });

    const mpActualizado = await p.productos.findUnique({ where: { idProducto: materiaPrima.idProducto } });
    const recetaActualizada = await p.recetasDosificados.findUnique({
      where: {
        idProdTerm_idMatPrima: {
          idProdTerm: dosificado.idProducto,
          idMatPrima: materiaPrima.idProducto,
        },
      },
    });
    const dosificadoActualizado = await p.productos.findUnique({ where: { idProducto: dosificado.idProducto } });

    const costoEsperadoPorTaza = (costoNuevo / 1000) * 7; // 60.000 / 1000 * 7 = $420
    console.log('   Materia Prima nueva Costo Base        : $', Number(mpActualizado.costoBase));
    console.log('   Costo Proporcional receta (observado) : $', Number(recetaActualizada.costoProporcional));
    console.log('   Costo Proporcional receta (esperado)  : $', costoEsperadoPorTaza);
    console.log('   ¿Match receta?                        :',
      Math.abs(Number(recetaActualizada.costoProporcional) - costoEsperadoPorTaza) < 0.01 ? '✅ SI (Trigger OK)' : '❌ NO');
    console.log('   Producto Dosificado nuevo Costo Base  : $', Number(dosificadoActualizado.costoBase));
    console.log('   ¿Match producto dosificado?           :',
      Math.abs(Number(dosificadoActualizado.costoBase) - costoEsperadoPorTaza) < 0.01 ? '✅ SI (fn_actualizar_costo_total_producto_dosificado OK)' : '❌ NO');

    console.log('\n🔚 ==== FIN VALIDACIÓN ====');
  } catch (e) {
    console.error('\n❌ ERROR VALIDACIÓN:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
