BEGIN;

-- AlterTable
ALTER TABLE "MAQUINAS_Y_TIENDAS" ADD COLUMN     "Ultimo_Contador_NR_Producto" BIGINT;

-- AlterTable
ALTER TABLE "MAPA_MATERIA_PRIMA" ADD COLUMN     "Precio_Cero" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MAPA_CAFE_NRQ" ADD COLUMN     "Lectura_Inicial" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VISITAS" ADD COLUMN     "NR_Producto_Actual" BIGINT,
ADD COLUMN     "NR_Producto_Anterior" BIGINT,
ADD COLUMN     "Reinicio_Contador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "Venta_NR" BIGINT;

-- AlterTable
ALTER TABLE "VENTAS_POR_VISITA" ADD COLUMN     "Diferencia_Unidades" BIGINT,
ADD COLUMN     "Diferencia_Venta" DECIMAL(18,2),
ADD COLUMN     "Unidades_NR_Producto" BIGINT,
ADD COLUMN     "Valor_Facturar_Cliente" DECIMAL(18,2),
ADD COLUMN     "Venta_Teorica_Productos" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "LECTURAS_NRQ" (
    "ID_Lectura" SERIAL NOT NULL,
    "ID_Visita" INTEGER NOT NULL,
    "ID_Mapa_NRQ" INTEGER,
    "ID_Prod_Term" INTEGER NOT NULL,
    "Opcion_Boton" VARCHAR(50) NOT NULL,
    "Lectura_Anterior" BIGINT NOT NULL,
    "Lectura_Actual" BIGINT NOT NULL,
    "Unidades" BIGINT NOT NULL,
    "Precio_Unitario" DECIMAL(18,2),
    "Subtotal" DECIMAL(18,2),

    CONSTRAINT "LECTURAS_NRQ_pkey" PRIMARY KEY ("ID_Lectura")
);

-- CreateIndex
CREATE INDEX "LECTURAS_NRQ_ID_Mapa_NRQ_idx" ON "LECTURAS_NRQ"("ID_Mapa_NRQ");

-- CreateIndex
CREATE UNIQUE INDEX "LECTURAS_NRQ_ID_Visita_ID_Mapa_NRQ_key" ON "LECTURAS_NRQ"("ID_Visita", "ID_Mapa_NRQ");

-- AddForeignKey
ALTER TABLE "LECTURAS_NRQ" ADD CONSTRAINT "LECTURAS_NRQ_ID_Visita_fkey" FOREIGN KEY ("ID_Visita") REFERENCES "VISITAS"("ID_Visita") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LECTURAS_NRQ" ADD CONSTRAINT "LECTURAS_NRQ_ID_Mapa_NRQ_fkey" FOREIGN KEY ("ID_Mapa_NRQ") REFERENCES "MAPA_CAFE_NRQ"("ID_Mapa_NRQ") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LECTURAS_NRQ" ADD CONSTRAINT "LECTURAS_NRQ_ID_Prod_Term_fkey" FOREIGN KEY ("ID_Prod_Term") REFERENCES "PRODUCTOS"("ID_Producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No extrapolar lecturas acumuladas de NRQ ni NR producto a partir de datos históricos.
-- Si el histórico no guardó cliente, conservar la asociación disponible al migrar.
UPDATE "VISITAS" vi
SET "ID_Cliente" = m."ID_Cliente"
FROM "MAQUINAS_Y_TIENDAS" m
WHERE vi."ID_Maquina" = m."ID_Maquina" AND vi."ID_Cliente" IS NULL AND m."ID_Cliente" IS NOT NULL;

WITH historial AS (
  SELECT "ID_Visita", lag("NR_Efectivo_Actual", 1, 0::bigint) OVER (
    PARTITION BY "ID_Maquina" ORDER BY "Fecha_Visita", "ID_Visita"
  ) AS anterior
  FROM "VISITAS"
  WHERE "NR_Efectivo_Actual" IS NOT NULL AND "Estado" <> 'ANULADA'
)
UPDATE "VISITAS" vi
SET "NR_Efectivo_Anterior" = h.anterior
FROM historial h
WHERE vi."ID_Visita" = h."ID_Visita" AND vi."NR_Efectivo_Anterior" IS NULL;

UPDATE "VISITAS" vi
SET "Venta_NR" = greatest(0, least(v."Total_Vendido", 9223372036854775807))::bigint
FROM "VENTAS_POR_VISITA" v
WHERE v."ID_Grupo" = vi."ID_Visita";

UPDATE "VISITAS"
SET "Venta_NR" = greatest(0, "NR_Efectivo_Actual" - "NR_Efectivo_Anterior")
WHERE "Venta_NR" IS NULL AND "NR_Efectivo_Actual" IS NOT NULL AND "NR_Efectivo_Anterior" IS NOT NULL;

DROP TRIGGER IF EXISTS trg_audit_lecturas_nrq ON "LECTURAS_NRQ";
CREATE TRIGGER trg_audit_lecturas_nrq AFTER INSERT OR UPDATE OR DELETE ON "LECTURAS_NRQ"
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

COMMIT;
