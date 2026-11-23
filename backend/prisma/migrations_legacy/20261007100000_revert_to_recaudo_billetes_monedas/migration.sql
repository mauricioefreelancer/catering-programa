-- Adecuación de la base de datos al commit bueno `da2a5ab`
-- ("Recaudo: dividir efectivo en billetes y monedas", 2026-10-06).
-- Se eliminan las estructuras que NO pertenecen a ese commit para que el
-- esquema coincida con el backend/frontend del punto correcto.

-- 1) Tabla VENTAS_POR_VISITA (solo existía en commits posteriores al punto bueno)
DROP TABLE IF EXISTS "VENTAS_POR_VISITA";

-- 2) Columnas extra en DESPACHOS_BODEGA (no existían en el commit bueno)
ALTER TABLE "DESPACHOS_BODEGA" DROP COLUMN IF EXISTS "ID_Mapa_MP";
ALTER TABLE "DESPACHOS_BODEGA" DROP COLUMN IF EXISTS "Stock_Antes";
ALTER TABLE "DESPACHOS_BODEGA" DROP COLUMN IF EXISTS "Stock_Despues";

-- 3) Columnas extra de desglose de efectivo en TESORERIA_EFECTIVO_NR
--    (el commit bueno solo maneja Efectivo_Recog; los desgloses Billetes/Monedas
--     eran de commits posteriores)
ALTER TABLE "TESORERIA_EFECTIVO_NR" DROP COLUMN IF EXISTS "Billetes";
ALTER TABLE "TESORERIA_EFECTIVO_NR" DROP COLUMN IF EXISTS "Monedas";
ALTER TABLE "TESORERIA_EFECTIVO_NR" DROP COLUMN IF EXISTS "Efectivo_Billetes";
ALTER TABLE "TESORERIA_EFECTIVO_NR" DROP COLUMN IF EXISTS "Efectivo_Monedas";