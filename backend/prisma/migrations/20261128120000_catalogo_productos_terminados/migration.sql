-- Catálogo fijo de productos terminados de café con su receta estándar (tabla de
-- dosificación de la empresa). Los productos terminados se agregan solo por código.
-- Idempotente: no duplica ni sobrescribe lo que ya exista. También lo usa
-- scripts/reset-datos-prueba.js para recargar el catálogo tras una limpieza.

INSERT INTO "PRODUCTOS" ("Codigo_Barras", "Nombre_Producto", "Tipo_Producto", "Unidad_Compra", "Unidad_Consumo", "Equivalencia", "Estado")
SELECT v.codigo, v.nombre, 'DOSIFICADO', 'Unidad', 'Unidad', 1, true
FROM (VALUES
  ('PT-TINTO-EXPRESSO', 'Tinto expresso'),
  ('PT-TINTO-AMERICANO', 'Tinto americano'),
  ('PT-CAFE-CON-LECHE', 'Café con leche'),
  ('PT-CAPUCCINO', 'Capuccino'),
  ('PT-MOCACCINO', 'Mocaccino'),
  ('PT-CHOCOLECHE', 'Chocoleche'),
  ('PT-CHOCOLATE', 'Chocolate'),
  ('PT-LECHE', 'Leche'),
  ('PT-AROMATICA', 'Aromática')
) AS v(codigo, nombre)
ON CONFLICT ("Codigo_Barras") DO NOTHING;

INSERT INTO "RECETAS_ESTANDAR" ("ID_Prod_Term", "Variante_Cafe", "Categoria_Insumo", "Cantidad_Dosis")
SELECT p."ID_Producto", r.variante, r.categoria, r.dosis
FROM (VALUES
  ('PT-TINTO-EXPRESSO', 'GRANO', 'CAFE_GRANO', 8),
  ('PT-TINTO-EXPRESSO', 'GRANO', 'VASO', 1),
  ('PT-TINTO-EXPRESSO', 'GRANO', 'MEZCLADOR', 1),
  ('PT-TINTO-EXPRESSO', 'GRANO', 'AZUCAR', 5),
  ('PT-TINTO-EXPRESSO', 'SOLUBLE', 'CAFE_SOLUBLE', 2),
  ('PT-TINTO-EXPRESSO', 'SOLUBLE', 'VASO', 1),
  ('PT-TINTO-EXPRESSO', 'SOLUBLE', 'MEZCLADOR', 1),
  ('PT-TINTO-EXPRESSO', 'SOLUBLE', 'AZUCAR', 5),
  ('PT-TINTO-AMERICANO', 'GRANO', 'CAFE_GRANO', 8),
  ('PT-TINTO-AMERICANO', 'GRANO', 'VASO', 1),
  ('PT-TINTO-AMERICANO', 'GRANO', 'MEZCLADOR', 1),
  ('PT-TINTO-AMERICANO', 'GRANO', 'AZUCAR', 5),
  ('PT-TINTO-AMERICANO', 'SOLUBLE', 'CAFE_SOLUBLE', 2),
  ('PT-TINTO-AMERICANO', 'SOLUBLE', 'VASO', 1),
  ('PT-TINTO-AMERICANO', 'SOLUBLE', 'MEZCLADOR', 1),
  ('PT-TINTO-AMERICANO', 'SOLUBLE', 'AZUCAR', 5),
  ('PT-CAFE-CON-LECHE', 'GRANO', 'CAFE_GRANO', 8),
  ('PT-CAFE-CON-LECHE', 'GRANO', 'LECHE_POLVO', 14),
  ('PT-CAFE-CON-LECHE', 'GRANO', 'VASO', 1),
  ('PT-CAFE-CON-LECHE', 'GRANO', 'MEZCLADOR', 1),
  ('PT-CAFE-CON-LECHE', 'GRANO', 'AZUCAR', 5),
  ('PT-CAFE-CON-LECHE', 'SOLUBLE', 'CAFE_SOLUBLE', 2),
  ('PT-CAFE-CON-LECHE', 'SOLUBLE', 'LECHE_POLVO', 14),
  ('PT-CAFE-CON-LECHE', 'SOLUBLE', 'VASO', 1),
  ('PT-CAFE-CON-LECHE', 'SOLUBLE', 'MEZCLADOR', 1),
  ('PT-CAFE-CON-LECHE', 'SOLUBLE', 'AZUCAR', 5),
  ('PT-CAPUCCINO', 'GRANO', 'CAFE_GRANO', 8),
  ('PT-CAPUCCINO', 'GRANO', 'LECHE_POLVO', 12),
  ('PT-CAPUCCINO', 'GRANO', 'CHOCOLATE', 7),
  ('PT-CAPUCCINO', 'GRANO', 'VASO', 1),
  ('PT-CAPUCCINO', 'GRANO', 'MEZCLADOR', 1),
  ('PT-CAPUCCINO', 'GRANO', 'AZUCAR', 5),
  ('PT-CAPUCCINO', 'SOLUBLE', 'CAFE_SOLUBLE', 2),
  ('PT-CAPUCCINO', 'SOLUBLE', 'LECHE_POLVO', 12),
  ('PT-CAPUCCINO', 'SOLUBLE', 'CHOCOLATE', 7),
  ('PT-CAPUCCINO', 'SOLUBLE', 'VASO', 1),
  ('PT-CAPUCCINO', 'SOLUBLE', 'MEZCLADOR', 1),
  ('PT-CAPUCCINO', 'SOLUBLE', 'AZUCAR', 5),
  ('PT-MOCACCINO', 'GRANO', 'CAFE_GRANO', 8),
  ('PT-MOCACCINO', 'GRANO', 'LECHE_POLVO', 7),
  ('PT-MOCACCINO', 'GRANO', 'CHOCOLATE', 12),
  ('PT-MOCACCINO', 'GRANO', 'VASO', 1),
  ('PT-MOCACCINO', 'GRANO', 'MEZCLADOR', 1),
  ('PT-MOCACCINO', 'GRANO', 'AZUCAR', 5),
  ('PT-MOCACCINO', 'SOLUBLE', 'CAFE_SOLUBLE', 2),
  ('PT-MOCACCINO', 'SOLUBLE', 'LECHE_POLVO', 7),
  ('PT-MOCACCINO', 'SOLUBLE', 'CHOCOLATE', 12),
  ('PT-MOCACCINO', 'SOLUBLE', 'VASO', 1),
  ('PT-MOCACCINO', 'SOLUBLE', 'MEZCLADOR', 1),
  ('PT-MOCACCINO', 'SOLUBLE', 'AZUCAR', 5),
  ('PT-CHOCOLECHE', 'SIN_CAFE', 'LECHE_POLVO', 10),
  ('PT-CHOCOLECHE', 'SIN_CAFE', 'CHOCOLATE', 16),
  ('PT-CHOCOLECHE', 'SIN_CAFE', 'VASO', 1),
  ('PT-CHOCOLECHE', 'SIN_CAFE', 'MEZCLADOR', 1),
  ('PT-CHOCOLATE', 'SIN_CAFE', 'CHOCOLATE', 16),
  ('PT-CHOCOLATE', 'SIN_CAFE', 'VASO', 1),
  ('PT-CHOCOLATE', 'SIN_CAFE', 'MEZCLADOR', 1),
  ('PT-LECHE', 'SIN_CAFE', 'LECHE_POLVO', 17),
  ('PT-LECHE', 'SIN_CAFE', 'VASO', 1),
  ('PT-LECHE', 'SIN_CAFE', 'MEZCLADOR', 1),
  ('PT-AROMATICA', 'SIN_CAFE', 'AROMATICA', 10),
  ('PT-AROMATICA', 'SIN_CAFE', 'VASO', 1),
  ('PT-AROMATICA', 'SIN_CAFE', 'MEZCLADOR', 1)
) AS r(codigo, variante, categoria, dosis)
JOIN "PRODUCTOS" p ON p."Codigo_Barras" = r.codigo AND p."Tipo_Producto" = 'DOSIFICADO'
ON CONFLICT ("ID_Prod_Term", "Variante_Cafe", "Categoria_Insumo") DO NOTHING;
