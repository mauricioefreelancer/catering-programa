-- Primer día facturable al cliente cuando la máquina aún no tiene un corte anterior.
ALTER TABLE "MAQUINAS_Y_TIENDAS" ADD COLUMN "Fecha_Inicio_Facturacion" DATE;
