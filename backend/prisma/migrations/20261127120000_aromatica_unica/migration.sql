-- Una sola categoría de aromática (dosis estándar 10 g). Unifica las dos anteriores.
BEGIN;

-- Si una receta tiene las dos aromáticas, se conserva la de frutos rojos (10 g).
DELETE FROM "RECETAS_ESTANDAR" y
 WHERE y."Categoria_Insumo" = 'AROMATICA_YERBABUENA'
   AND EXISTS (SELECT 1 FROM "RECETAS_ESTANDAR" f
                WHERE f."ID_Prod_Term" = y."ID_Prod_Term" AND f."Variante_Cafe" = y."Variante_Cafe"
                  AND f."Categoria_Insumo" = 'AROMATICA_FRUTOS_ROJOS');
UPDATE "RECETAS_ESTANDAR" SET "Categoria_Insumo" = 'AROMATICA'
 WHERE "Categoria_Insumo" IN ('AROMATICA_FRUTOS_ROJOS', 'AROMATICA_YERBABUENA');

DELETE FROM "RECETA_BOTON" y
 WHERE y."Categoria_Insumo" = 'AROMATICA_YERBABUENA'
   AND EXISTS (SELECT 1 FROM "RECETA_BOTON" f
                WHERE f."ID_Mapa_NRQ" = y."ID_Mapa_NRQ" AND f."Categoria_Insumo" = 'AROMATICA_FRUTOS_ROJOS');
UPDATE "RECETA_BOTON" SET "Categoria_Insumo" = 'AROMATICA'
 WHERE "Categoria_Insumo" IN ('AROMATICA_FRUTOS_ROJOS', 'AROMATICA_YERBABUENA');

UPDATE "PRODUCTOS" SET "Categoria_Insumo" = 'AROMATICA'
 WHERE "Categoria_Insumo" IN ('AROMATICA_FRUTOS_ROJOS', 'AROMATICA_YERBABUENA', 'AROMATICA_HIERBA_BUENA');

COMMIT;
