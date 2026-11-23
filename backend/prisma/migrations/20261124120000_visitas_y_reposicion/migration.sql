BEGIN;

LOCK TABLE "PEDIDOS_OPERADOR", "VENTAS_POR_VISITA", "TESORERIA_EFECTIVO_NR", "PRODUCTOS"
  IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PRODUCTOS" WHERE "Stock_Actual" < 0) THEN
    RAISE EXCEPTION 'Fase 2: hay productos con stock negativo; revisar antes de migrar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "TESORERIA_EFECTIVO_NR" WHERE "ID_Grupo" IS NOT NULL
    GROUP BY "ID_Grupo" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Fase 2: hay grupos con recaudos duplicados; revisar antes de migrar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "ID_Grupo", "ID_Maquina", "ID_Operador" FROM "PEDIDOS_OPERADOR"
      UNION ALL SELECT "ID_Grupo", "ID_Maquina", "ID_Operador" FROM "VENTAS_POR_VISITA"
      UNION ALL SELECT "ID_Grupo", "ID_Maquina", "ID_Operador" FROM "TESORERIA_EFECTIVO_NR"
    ) g WHERE "ID_Grupo" IS NOT NULL
    GROUP BY "ID_Grupo" HAVING count(DISTINCT ROW("ID_Maquina", "ID_Operador")) > 1
  ) THEN
    RAISE EXCEPTION 'Fase 2: un grupo historico corresponde a distintas maquinas u operadores';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "ID_Grupo" FROM "VENTAS_POR_VISITA" UNION ALL
      SELECT "ID_Grupo" FROM "TESORERIA_EFECTIVO_NR"
    ) g WHERE g."ID_Grupo" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "PEDIDOS_OPERADOR" p WHERE p."ID_Grupo" = g."ID_Grupo"
    )
  ) THEN
    RAISE EXCEPTION 'Fase 2: hay ventas o recaudos con grupo sin pedido historico';
  END IF;
END $$;

ALTER TABLE "PRODUCTOS"
  ADD CONSTRAINT "PRODUCTOS_Stock_Actual_no_negativo" CHECK ("Stock_Actual" >= 0);

-- AlterTable
ALTER TABLE "PEDIDOS_OPERADOR" ADD COLUMN     "Fecha_Faltante_Original" TIMESTAMP(3),
ADD COLUMN     "ID_Pedido_Reemplazado" INTEGER,
ADD COLUMN     "Pendiente_Congelado" INTEGER;

-- CreateTable
CREATE TABLE "VISITAS" (
    "ID_Visita" SERIAL NOT NULL,
    "ID_Maquina" INTEGER NOT NULL,
    "ID_Operador" INTEGER NOT NULL,
    "ID_Cliente" INTEGER,
    "Fecha_Visita" TIMESTAMP(3) NOT NULL,
    "Estado" VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA',
    "NR_Efectivo_Anterior" BIGINT,
    "NR_Efectivo_Actual" BIGINT,
    "Id_Offline" VARCHAR(64),
    "Observaciones" TEXT,
    "Fecha_Creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ID_Usuario_Registro" INTEGER,

    CONSTRAINT "VISITAS_pkey" PRIMARY KEY ("ID_Visita")
);

-- Los grupos nulos se conservan sin vincular: no hay identidad de visita que recuperar.
WITH origen AS (
  SELECT "ID_Grupo", min("ID_Maquina") AS maquina, min("ID_Operador") AS operador,
         min("Fecha_Hora") AS fecha, max("NR_Actual_Medido") AS nr,
         bool_and("Estado" IN ('APROBADO', 'RECHAZADO')) AS cerrada
  FROM "PEDIDOS_OPERADOR" WHERE "ID_Grupo" IS NOT NULL GROUP BY "ID_Grupo"
)
INSERT INTO "VISITAS" ("ID_Visita", "ID_Maquina", "ID_Operador", "ID_Cliente", "Fecha_Visita",
                      "Fecha_Creacion", "Estado", "NR_Efectivo_Anterior", "NR_Efectivo_Actual")
SELECT p."ID_Grupo", p.maquina, p.operador, v."ID_Cliente", p.fecha, p.fecha,
       CASE WHEN r."Estado" = 'CERRADO' THEN 'RECAUDADA'
            WHEN p.cerrada THEN 'DESPACHADA' ELSE 'REGISTRADA' END,
       coalesce(v."NR_Anterior", r."NR_Anterior"), coalesce(v."NR_Actual", p.nr, r."NR_Actual")
FROM origen p
LEFT JOIN "VENTAS_POR_VISITA" v ON v."ID_Grupo" = p."ID_Grupo"
LEFT JOIN "TESORERIA_EFECTIVO_NR" r ON r."ID_Grupo" = p."ID_Grupo";

SELECT setval(pg_get_serial_sequence('"VISITAS"', 'ID_Visita'),
              coalesce((SELECT max("ID_Visita")::bigint + 1 FROM "VISITAS"), 1), false);

-- CreateIndex
CREATE UNIQUE INDEX "VISITAS_Id_Offline_key" ON "VISITAS"("Id_Offline");

-- CreateIndex
CREATE INDEX "VISITAS_ID_Maquina_Fecha_Visita_idx" ON "VISITAS"("ID_Maquina", "Fecha_Visita");

-- CreateIndex
CREATE INDEX "PEDIDOS_OPERADOR_ID_Grupo_idx" ON "PEDIDOS_OPERADOR"("ID_Grupo");

-- CreateIndex
CREATE INDEX "PEDIDOS_OPERADOR_ID_Maquina_ID_Mapa_MP_Estado_idx" ON "PEDIDOS_OPERADOR"("ID_Maquina", "ID_Mapa_MP", "Estado");

-- CreateIndex
CREATE UNIQUE INDEX "TESORERIA_EFECTIVO_NR_ID_Grupo_key" ON "TESORERIA_EFECTIVO_NR"("ID_Grupo");

-- AddForeignKey
ALTER TABLE "VISITAS" ADD CONSTRAINT "VISITAS_ID_Maquina_fkey" FOREIGN KEY ("ID_Maquina") REFERENCES "MAQUINAS_Y_TIENDAS"("ID_Maquina") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VISITAS" ADD CONSTRAINT "VISITAS_ID_Operador_fkey" FOREIGN KEY ("ID_Operador") REFERENCES "OPERADORES"("ID_Operador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VISITAS" ADD CONSTRAINT "VISITAS_ID_Cliente_fkey" FOREIGN KEY ("ID_Cliente") REFERENCES "CLIENTES"("ID_Cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VISITAS" ADD CONSTRAINT "VISITAS_ID_Usuario_Registro_fkey" FOREIGN KEY ("ID_Usuario_Registro") REFERENCES "USUARIOS_SISTEMA"("ID_Usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PEDIDOS_OPERADOR" ADD CONSTRAINT "PEDIDOS_OPERADOR_ID_Grupo_fkey" FOREIGN KEY ("ID_Grupo") REFERENCES "VISITAS"("ID_Visita") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PEDIDOS_OPERADOR" ADD CONSTRAINT "PEDIDOS_OPERADOR_ID_Pedido_Reemplazado_fkey" FOREIGN KEY ("ID_Pedido_Reemplazado") REFERENCES "PEDIDOS_OPERADOR"("ID_Pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VENTAS_POR_VISITA" ADD CONSTRAINT "VENTAS_POR_VISITA_ID_Grupo_fkey" FOREIGN KEY ("ID_Grupo") REFERENCES "VISITAS"("ID_Visita") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TESORERIA_EFECTIVO_NR" ADD CONSTRAINT "TESORERIA_EFECTIVO_NR_ID_Grupo_fkey" FOREIGN KEY ("ID_Grupo") REFERENCES "VISITAS"("ID_Visita") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS trg_audit_visitas ON "VISITAS";
CREATE TRIGGER trg_audit_visitas AFTER INSERT OR UPDATE OR DELETE ON "VISITAS"
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

COMMIT;
