-- RESTAURACIÓN del esquema al estado deseado por el backend actual.
-- La migración "revert_to_recaudo_billetes_monedas" fue aplicada en producción y
-- eliminó VENTAS_POR_VISITA, las columnas de trazabilidad de DESPACHOS_BODEGA
-- (ID_Mapa_MP, Stock_Antes, Stock_Despues) y el desglose de efectivo
-- (Efectivo_Billetes, Efectivo_Monedas). El backend / Prisma Client actual los
-- requiere, por lo que esta migración reconstruye ese estado de forma idempotente.

-- 1) Tabla VENTAS_POR_VISITA (con la columna Total_Vendido_Productos ya incluida)
CREATE TABLE IF NOT EXISTS "VENTAS_POR_VISITA" (
    "ID_Visita" SERIAL NOT NULL,
    "ID_Grupo" INTEGER,
    "ID_Maquina" INTEGER NOT NULL,
    "ID_Cliente" INTEGER,
    "ID_Operador" INTEGER NOT NULL,
    "Fecha_Visita" TIMESTAMP(3) NOT NULL,
    "NR_Anterior" BIGINT NOT NULL DEFAULT 0,
    "NR_Actual" BIGINT NOT NULL DEFAULT 0,
    "Total_Vendido" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Total_Despachado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Total_Vendido_Productos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Unidades_Sugeridas" INTEGER NOT NULL DEFAULT 0,
    "Detalle" JSONB,
    "Firma_Fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Firma_Usuario" INTEGER,
    "Firma_Origen" VARCHAR(20) NOT NULL DEFAULT 'REGISTRO',

    CONSTRAINT "VENTAS_POR_VISITA_pkey" PRIMARY KEY ("ID_Visita")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VENTAS_POR_VISITA_ID_Grupo_key" ON "VENTAS_POR_VISITA"("ID_Grupo");
CREATE INDEX IF NOT EXISTS "VENTAS_POR_VISITA_ID_Maquina_Fecha_Visita_idx" ON "VENTAS_POR_VISITA"("ID_Maquina", "Fecha_Visita");
CREATE INDEX IF NOT EXISTS "VENTAS_POR_VISITA_ID_Cliente_idx" ON "VENTAS_POR_VISITA"("ID_Cliente");

ALTER TABLE "VENTAS_POR_VISITA" ADD CONSTRAINT "VENTAS_POR_VISITA_ID_Maquina_fkey" FOREIGN KEY ("ID_Maquina") REFERENCES "MAQUINAS_Y_TIENDAS"("ID_Maquina") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VENTAS_POR_VISITA" ADD CONSTRAINT "VENTAS_POR_VISITA_ID_Cliente_fkey" FOREIGN KEY ("ID_Cliente") REFERENCES "CLIENTES"("ID_Cliente") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VENTAS_POR_VISITA" ADD CONSTRAINT "VENTAS_POR_VISITA_ID_Operador_fkey" FOREIGN KEY ("ID_Operador") REFERENCES "OPERADORES"("ID_Operador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Trazabilidad de despacho en DESPACHOS_BODEGA (re-agregar)
ALTER TABLE "DESPACHOS_BODEGA"
  ADD COLUMN IF NOT EXISTS "ID_Mapa_MP" INTEGER,
  ADD COLUMN IF NOT EXISTS "Stock_Antes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "Stock_Despues" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DESPACHOS_BODEGA"
  ADD CONSTRAINT "DESPACHOS_BODEGA_ID_Mapa_MP_fkey" FOREIGN KEY ("ID_Mapa_MP")
  REFERENCES "MAPA_MATERIA_PRIMA"("ID_Mapa_MP") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Desglose del efectivo recogido en TESORERIA_EFECTIVO_NR (re-agregar)
ALTER TABLE "TESORERIA_EFECTIVO_NR"
  ADD COLUMN IF NOT EXISTS "Efectivo_Billetes" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "Efectivo_Monedas" DECIMAL(18,2) NOT NULL DEFAULT 0;