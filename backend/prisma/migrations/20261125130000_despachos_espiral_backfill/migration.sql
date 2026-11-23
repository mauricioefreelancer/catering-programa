-- Despachos antiguos registrados antes de guardar el espiral: toman el espiral de su pedido.
UPDATE "DESPACHOS_BODEGA" d
SET "ID_Mapa_MP" = p."ID_Mapa_MP"
FROM "PEDIDOS_OPERADOR" p
WHERE d."ID_Pedido" = p."ID_Pedido"
  AND d."ID_Mapa_MP" IS NULL
  AND p."ID_Mapa_MP" IS NOT NULL;
