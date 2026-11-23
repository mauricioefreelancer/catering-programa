-- Fix: restablecer la unicidad del codigo de barras en PRODUCTOS.
-- La columna "Codigo_Barras" habia perdido su constraint @unique en el esquema.
-- Corrige el seed y evita productos con codigo de barras duplicado.
--
-- Usamos IF NOT EXISTS para que sea idempotente: si el entorno de produccion
-- ya lo habia aplicado (p.ej. via db push), no falla el deploy.
CREATE UNIQUE INDEX IF NOT EXISTS "PRODUCTOS_Codigo_Barras_key" ON "PRODUCTOS"("Codigo_Barras");