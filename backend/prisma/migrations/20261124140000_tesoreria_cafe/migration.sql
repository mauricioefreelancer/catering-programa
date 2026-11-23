BEGIN;

ALTER TABLE "TESORERIA_EFECTIVO_NR" ADD COLUMN "Nequi_Recog" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "SALDOS_DIGITALES" ADD COLUMN "ID_Visita" INTEGER;
ALTER TABLE "SALDOS_DIGITALES" ADD CONSTRAINT "SALDOS_DIGITALES_ID_Visita_fkey"
  FOREIGN KEY ("ID_Visita") REFERENCES "VISITAS"("ID_Visita") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SALDOS_DIGITALES_ID_Visita_idx" ON "SALDOS_DIGITALES"("ID_Visita");

-- Si existen duplicados, detener la migración y conservar los registros.
CREATE UNIQUE INDEX "uq_facturacion_nrq_periodo"
  ON "TESORERIA_FACTURACION_NRQ"("ID_Maquina", "ID_Prod_Term", "Fecha_Inicio", "Fecha_Fin");

DO $$
DECLARE definicion text;
BEGIN
  SELECT pg_get_functiondef('public.fn_audit_trigger_generico()'::regprocedure) INTO definicion;
  IF position('v_modulo   := CASE v_tabla' IN definicion) = 0
     OR position('v_campo_pk := CASE v_tabla' IN definicion) = 0 THEN
    RAISE EXCEPTION 'La función de auditoría no coincide con el baseline';
  END IF;
  definicion := replace(definicion, 'v_modulo   := CASE v_tabla',
    'v_modulo   := CASE v_tabla WHEN ''VISITAS'' THEN ''Inventario::Visitas'' WHEN ''LECTURAS_NRQ'' THEN ''Tesoreria::LecturasNRQ''');
  definicion := replace(definicion, 'v_campo_pk := CASE v_tabla',
    'v_campo_pk := CASE v_tabla WHEN ''VISITAS'' THEN ''ID_Visita'' WHEN ''LECTURAS_NRQ'' THEN ''ID_Lectura''');
  EXECUTE definicion;
END $$;

COMMIT;
