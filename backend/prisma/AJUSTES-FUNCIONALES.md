# Ajustes funcionales

## A0: referencia del despliegue

- Render publicó `9d114e0`. La comprobación de solo lectura de `_prisma_migrations` confirmó `0_baseline` y las tres migraciones de visitas, contadores y tesorería. `prisma migrate status` informó `Database schema is up to date`.
- La adopción y las tres migraciones se ejecutaron durante la ventana de mantenimiento anterior. Después se publicó el commit en Render. El servicio figura como gestionado por Blueprint, pero el panel todavía muestra `migrate deploy` dentro del comando de compilación y un paso de predespliegue vacío. Antes de publicar los ajustes, alinear los comandos efectivos con el README: `npm ci && npx prisma generate && npm run build` y, aparte, `npx prisma migrate deploy`. No aplicar de nuevo el baseline.
- Pasaron 18 pruebas y ambas compilaciones en la revisión de referencia. La prueba autenticada de snacks y café se hizo en PostgreSQL local con datos ficticios: visita, despacho parcial, descuento de stock, cierre de recaudo e informe. No se hizo esa prueba con escrituras en producción.
- `STOCK_PROVEEDOR` conserva 35 filas en producción.

## A1-A3: negociación y venta teórica

Aplicar `20261124150000_negociacion_clientes` antes de iniciar el backend actualizado. Publicar el frontend compatible junto con el backend. La migración no elimina columnas: los contadores NR producto se conservan como datos históricos. Los espirales antiguos marcados `Precio_Cero` migran al 100 % y sus máquinas a negociación especial. No se infieren porcentajes para lecturas NRQ anteriores a la migración.

El control de venta excluye las tolvas y separa la parte cobrada por la máquina del valor a cargo del cliente. Si falta base comparable o precio, no se informa diferencia contra el NR efectivo y se conserva el motivo por línea.
