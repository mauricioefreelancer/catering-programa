# Ajustes funcionales

## A0: referencia del despliegue

- Render publicó `9d114e0`. La comprobación de solo lectura de `_prisma_migrations` confirmó `0_baseline` y las tres migraciones de visitas, contadores y tesorería. `prisma migrate status` informó `Database schema is up to date`.
- La adopción y las tres migraciones se ejecutaron durante la ventana de mantenimiento anterior. Después se publicó el commit en Render. El servicio figura como gestionado por Blueprint, pero el panel todavía muestra `migrate deploy` dentro del comando de compilación y un paso de predespliegue vacío. Antes de publicar los ajustes, alinear los comandos efectivos con el README: `npm ci && npx prisma generate && npm run build` y, aparte, `npx prisma migrate deploy`. No aplicar de nuevo el baseline.
- Pasaron 18 pruebas y ambas compilaciones en la revisión de referencia. La prueba autenticada de snacks y café se hizo en PostgreSQL local con datos ficticios: visita, despacho parcial, descuento de stock, cierre de recaudo e informe. No se hizo esa prueba con escrituras en producción.
- `STOCK_PROVEEDOR` conserva 35 filas en producción.

## A1-A3: negociación y venta teórica

Aplicar `20261124150000_negociacion_clientes` antes de iniciar el backend actualizado. Publicar el frontend compatible junto con el backend. La migración no elimina columnas: los contadores NR producto se conservan como datos históricos. Los espirales antiguos marcados `Precio_Cero` migran al 100 % y sus máquinas a negociación especial. No se infieren porcentajes para lecturas NRQ anteriores a la migración.

El control de venta excluye las tolvas y separa la parte cobrada por la máquina del valor a cargo del cliente. Si falta base comparable o precio, no se informa diferencia contra el NR efectivo y se conserva el motivo por línea.

## A4: físico y consumo de materia prima

Aplicar `20261124160000_control_consumo_mp` después de la migración de negociación y antes de arrancar el backend actualizado. Publicar el móvil junto con el backend. Las visitas anteriores conservan `Diferencia_MP_Valor` en `NULL`.

El físico de cada tolva se registra en su unidad de compra y el pedido se calcula como capacidad menos físico. El control independiente convierte el consumo real a la unidad de consumo del producto, suma las dosis de los botones y conserva en `detalle.controlesMP` la equivalencia y el costo base usados. Si falta la base física de una tolva o una materia prima de la receta no tiene tolva, se conserva el motivo y el total no se informa como comparable.

### Estado del esquema en Render

Durante un ensayo, `DIRECT_URL` apuntaba a Render aunque `DATABASE_URL` apuntaba a loopback. Prisma aplicó en Render `20261124150000_negociacion_clientes` y `20261124160000_control_consumo_mp` el 23 de noviembre de 2026 a las 16:08 de Colombia. No se publicó código nuevo. La verificación posterior de solo lectura confirmó ambas migraciones completas, 35 filas en `STOCK_PROVEEDOR` y cero visitas con valor de diferencia MP.

Mantener intactos los archivos de migración ya aplicados. Para ensayos locales de Prisma, asignar explícitamente **ambas** variables (`DATABASE_URL` y `DIRECT_URL`) a la misma instancia de loopback antes de ejecutar cualquier migración.

## A5–A6: cortes y facturación al cliente

Aplicar `20261124170000_nrq_espiral_facturacion` antes de arrancar el nuevo backend. Los cortes no se inventan para visitas antiguas. Las facturas existentes conservan sus importes; las nuevas usan el precio y porcentaje de cada lectura positiva entre el corte del mes anterior (exclusivo) y el actual (incluido), en hora de Colombia. El porcentaje agregado es efectivo sobre el valor de venta. Sin dos cortes no se genera factura para esa máquina.

El nuevo endpoint es `/api/tesoreria/facturacion-cliente/generar`; el anterior queda como alias temporal. Las lecturas NRQ nuevas exigen un único mapa de origen. El `CHECK` se crea con `NOT VALID` para no borrar ni modificar lecturas antiguas cuyo botón se eliminó; las claves foráneas protegen los mapas con lecturas de nuevos borrados.
