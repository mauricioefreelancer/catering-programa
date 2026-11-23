# Adopción de `0_baseline`

## Qué cambia

`migrations/0_baseline` crea el esquema vigente en bases nuevas e instala la función, los 18 triggers y la política de auditoría. El historial de referencia queda en `migrations_legacy/`; Prisma no lo vuelve a ejecutar. No hay cambios de esquema ni backfill de datos de negocio en esta fase.

La comparación de solo lectura con Render mediante `prisma migrate diff` devolvió un diff vacío. También se verificaron el cuerpo de la función de auditoría, los 18 triggers y la política `audit_log_select_all`; RLS está desactivado en la base existente y el baseline conserva ese estado.

El control previo no encontró productos con stock negativo, grupos de recaudo duplicados ni ventas o recaudos con grupo informado sin pedido. `STOCK_PROVEEDOR` contiene 35 filas: conservar la tabla y acordar su exportación antes de plantear su eliminación en una fase posterior.

## Bases nuevas

Desde `backend`, con `DATABASE_URL` y `DIRECT_URL` apuntando a un PostgreSQL vacío local:

```powershell
npx prisma migrate deploy
npx prisma migrate status
npx prisma db seed
npx prisma migrate diff --from-url "$env:DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script --exit-code
```

El diff debe quedar vacío. El seed se usa exclusivamente en la base local de pruebas.

## Base existente en Render

**Solo con autorización del responsable de la base y durante una ventana de mantenimiento.** No fusionar esta rama con despliegue automático activo hasta coordinar la adopción. No aplicar el SQL de `0_baseline` sobre producción.

1. Pausar los despliegues automáticos y cualquier proceso que ejecute migraciones. Confirmar visualmente el servidor y la base de destino. Usar un respaldo completo con `pg_dump` y un segundo respaldo para restaurar solo el historial si hiciera falta. Verificar el respaldo con `pg_restore --list` y ensayar el procedimiento completo sobre una restauración local. Para `pg_dump`/`psql`, usar una URL directa sin parámetros exclusivos de Prisma como `schema` o `pgbouncer`.

   ```powershell
   pg_dump --format=custom --file=catering-antes-baseline.dump "$env:PG_DIRECT_URL"
   pg_dump --data-only --table=public._prisma_migrations --file=catering-historial.sql "$env:PG_DIRECT_URL"
   pg_restore --list catering-antes-baseline.dump
   ```

2. En la revisión que contiene `0_baseline`, repetir el diff de solo lectura y comprobar que no hay drift. Verificar que el historial contiene únicamente las ocho migraciones archivadas y que todas están aplicadas. Detenerse ante cualquier discrepancia.
3. Una vez autorizado el cambio, y desde `backend`, reemplazar solo el registro histórico de Prisma. Detenerse si falla cualquier comando y mantener los despliegues pausados.

   ```powershell
   psql "$env:PG_DIRECT_URL" -v ON_ERROR_STOP=1 -c 'DELETE FROM public._prisma_migrations;'
   npx prisma migrate resolve --applied 0_baseline
   npx prisma migrate status
   npx prisma migrate diff --from-url "$env:DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script --exit-code
   ```

   Si no se consigue registrar y verificar el baseline, no continuar con el despliegue. Revisar primero si quedó una fila nueva registrada y recuperar el historial con `catering-historial.sql` sobre una tabla de historial vacía antes de volver al despliegue anterior.

4. Configurar Render con el comando de compilación y el pre-despliegue del README. Solo reactivar el despliegue después de confirmar `Database schema is up to date` y un diff vacío.
