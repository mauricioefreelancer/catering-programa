BEGIN;

CREATE TABLE "PARAMETROS_SISTEMA" (
  "Clave" VARCHAR(60) PRIMARY KEY,
  "Valor" DECIMAL(18,2) NOT NULL CHECK ("Valor" >= 0),
  "Tipo" VARCHAR(20) NOT NULL,
  "Descripcion" VARCHAR(200) NOT NULL,
  "Fecha_Actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ID_Usuario_Actualiza" INTEGER,
  CONSTRAINT "PARAMETROS_SISTEMA_ID_Usuario_Actualiza_fkey" FOREIGN KEY ("ID_Usuario_Actualiza")
    REFERENCES "USUARIOS_SISTEMA"("ID_Usuario") ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$
DECLARE definicion text;
BEGIN
  SELECT pg_get_functiondef('public.fn_audit_trigger_generico()'::regprocedure) INTO definicion;
  definicion := replace(definicion, 'v_modulo   := CASE v_tabla',
    'v_modulo   := CASE v_tabla WHEN ''PARAMETROS_SISTEMA'' THEN ''Admin::Parametros''');
  definicion := replace(definicion, 'v_campo_pk := CASE v_tabla',
    'v_campo_pk := CASE v_tabla WHEN ''PARAMETROS_SISTEMA'' THEN ''Clave''');
  EXECUTE definicion;
END $$;

CREATE TRIGGER trg_audit_parametros AFTER INSERT OR UPDATE OR DELETE ON "PARAMETROS_SISTEMA"
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

INSERT INTO "PARAMETROS_SISTEMA" ("Clave", "Valor", "Tipo", "Descripcion") VALUES
  ('TOLERANCIA_DIF_VENTA_COP', 10000, 'NUMERO', 'Tolerancia de la diferencia de venta (COP)'),
  ('TOLERANCIA_DIF_MP_COP', 10000, 'NUMERO', 'Tolerancia de la diferencia de materia prima (COP)');

ALTER TABLE "VENTAS_POR_VISITA"
  ADD COLUMN "Tolerancia_Aplicada" DECIMAL(18,2),
  ADD COLUMN "Tolerancia_MP_Aplicada" DECIMAL(18,2),
  ADD COLUMN "Alerta_Diferencia" BOOLEAN,
  ADD COLUMN "Alerta_MP" BOOLEAN;

COMMIT;
