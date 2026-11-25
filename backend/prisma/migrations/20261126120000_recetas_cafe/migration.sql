BEGIN;

-- Recetas estándar de la empresa: dosis por producto terminado, variante de café y
-- categoría de insumo (la receta apunta a la categoría, no a la marca).
CREATE TABLE "RECETAS_ESTANDAR" (
  "ID_Receta_Estandar" SERIAL PRIMARY KEY,
  "ID_Prod_Term" INTEGER NOT NULL,
  "Variante_Cafe" VARCHAR(20) NOT NULL CHECK ("Variante_Cafe" IN ('GRANO', 'SOLUBLE', 'SIN_CAFE')),
  "Categoria_Insumo" VARCHAR(40) NOT NULL,
  "Cantidad_Dosis" DECIMAL(18,4) NOT NULL CHECK ("Cantidad_Dosis" > 0),
  "Fecha_Actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RECETAS_ESTANDAR_ID_Prod_Term_fkey" FOREIGN KEY ("ID_Prod_Term")
    REFERENCES "PRODUCTOS"("ID_Producto") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_receta_estandar" UNIQUE ("ID_Prod_Term", "Variante_Cafe", "Categoria_Insumo")
);

-- Variante con la que se armó la receta del botón.
ALTER TABLE "MAPA_CAFE_NRQ" ADD COLUMN "Variante_Cafe" VARCHAR(20)
  CHECK ("Variante_Cafe" IS NULL OR "Variante_Cafe" IN ('GRANO', 'SOLUBLE', 'SIN_CAFE'));

-- Receta que usa cada botón en su máquina (copia ajustable de la estándar).
CREATE TABLE "RECETA_BOTON" (
  "ID_Receta_Boton" SERIAL PRIMARY KEY,
  "ID_Mapa_NRQ" INTEGER NOT NULL,
  "Categoria_Insumo" VARCHAR(40) NOT NULL,
  "Cantidad_Dosis" DECIMAL(18,4) NOT NULL CHECK ("Cantidad_Dosis" > 0),
  "Personalizada" BOOLEAN NOT NULL DEFAULT false,
  "Fecha_Actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RECETA_BOTON_ID_Mapa_NRQ_fkey" FOREIGN KEY ("ID_Mapa_NRQ")
    REFERENCES "MAPA_CAFE_NRQ"("ID_Mapa_NRQ") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "uq_receta_boton" UNIQUE ("ID_Mapa_NRQ", "Categoria_Insumo")
);

DO $$
DECLARE definicion text;
BEGIN
  SELECT pg_get_functiondef('public.fn_audit_trigger_generico()'::regprocedure) INTO definicion;
  definicion := replace(definicion, 'v_modulo   := CASE v_tabla',
    'v_modulo   := CASE v_tabla WHEN ''RECETAS_ESTANDAR'' THEN ''Productos::RecetasEstandar'' WHEN ''RECETA_BOTON'' THEN ''Maquinas::RecetaBoton''');
  definicion := replace(definicion, 'v_campo_pk := CASE v_tabla',
    'v_campo_pk := CASE v_tabla WHEN ''RECETAS_ESTANDAR'' THEN ''ID_Receta_Estandar'' WHEN ''RECETA_BOTON'' THEN ''ID_Receta_Boton''');
  EXECUTE definicion;
END $$;

CREATE TRIGGER trg_audit_recetas_estandar AFTER INSERT OR UPDATE OR DELETE ON "RECETAS_ESTANDAR"
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();
CREATE TRIGGER trg_audit_receta_boton AFTER INSERT OR UPDATE OR DELETE ON "RECETA_BOTON"
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

COMMIT;
