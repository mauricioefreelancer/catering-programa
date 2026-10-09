-- Total Vendido por productos: lo efectivamente cubierto por visita
-- (Σ (cantSugerida - pendiente) x precio). El pendiente por reponer
-- NO cuenta como venta. No se toca Total_Vendido (contador NR).
ALTER TABLE "VENTAS_POR_VISITA"
  ADD COLUMN "Total_Vendido_Productos" DECIMAL(18, 2) NOT NULL DEFAULT 0;