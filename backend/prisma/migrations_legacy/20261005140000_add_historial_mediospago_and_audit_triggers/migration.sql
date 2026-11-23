-- ==========================================================================
-- Migración: add_historial_mediospago_and_audit_triggers
-- 1) Crea la tabla HISTORIAL_MEDIOS_PAGO (trazabilidad por fecha/serial de
--    las modificaciones de medios de pago de cada máquina).
-- 2) Instala la función y los TRIGGERS DE AUDITORÍA en todas las tablas
--    maestras y transaccionales, para que AUDITORIA_LOG registre todo cambio.
--    (los recursos quedan activos al aplicarse esta migración).
--
-- Repetible y segura: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
-- No elimina ni altera datos existentes.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. TABLA HISTORIAL_MEDIOS_PAGO
-- Registra cada cambio de dispositivo de cobro (activo/inactivo) y de su
-- serial alfanumérico por máquina, con fecha exacta y usuario.
-- --------------------------------------------------------------------------
CREATE TABLE "HISTORIAL_MEDIOS_PAGO" (
    "ID_Historial" SERIAL NOT NULL,
    "ID_Maquina" INTEGER NOT NULL,
    "Serial_Maquina" VARCHAR(100) NOT NULL,
    "Tipo_Medio" VARCHAR(50) NOT NULL,
    "Serial_Dispositivo" VARCHAR(100),
    "Accion" VARCHAR(20) NOT NULL,
    "Valor_Anterior" JSONB,
    "Valor_Nuevo" JSONB,
    "ID_Usuario" INTEGER,
    "Fecha_Cambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HISTORIAL_MEDIOS_PAGO_pkey" PRIMARY KEY ("ID_Historial")
);

CREATE INDEX "idx_historial_maquina_fecha" ON "HISTORIAL_MEDIOS_PAGO"("ID_Maquina", "Fecha_Cambio");
CREATE INDEX "idx_historial_serial_fecha" ON "HISTORIAL_MEDIOS_PAGO"("Serial_Dispositivo", "Fecha_Cambio");

ALTER TABLE "HISTORIAL_MEDIOS_PAGO"
    ADD CONSTRAINT "HISTORIAL_MEDIOS_PAGO_ID_Maquina_fkey"
    FOREIGN KEY ("ID_Maquina") REFERENCES "MAQUINAS_Y_TIENDAS"("ID_Maquina")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HISTORIAL_MEDIOS_PAGO"
    ADD CONSTRAINT "HISTORIAL_MEDIOS_PAGO_ID_Usuario_fkey"
    FOREIGN KEY ("ID_Usuario") REFERENCES "USUARIOS_SISTEMA"("ID_Usuario")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- 2. FUNCIÓN DE AUDITORÍA GENERICA
-- Lee app.current_user_id / app.client_ip (seteados por el AuditMiddleware)
-- y escribe el cambio en AUDITORIA_LOG.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_trigger_generico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
    v_modulo       TEXT;
    v_tabla        TEXT;
    v_id_registro  TEXT;
    v_campo_pk     TEXT;
    v_old_row      JSONB;
    v_new_row      JSONB;
    v_detalle      JSONB;
    v_usuario_id   INTEGER;
    v_ip           TEXT;
BEGIN
    v_tabla    := TG_TABLE_NAME;
    v_modulo   := CASE v_tabla
        WHEN 'CLIENTES' THEN 'Clientes'
        WHEN 'PROVEEDORES' THEN 'Proveedores'
        WHEN 'PRODUCTOS' THEN 'Productos'
        WHEN 'RECETAS_DOSIFICADOS' THEN 'Productos::Recetas'
        WHEN 'PRECIOS_CLIENTE' THEN 'Precios'
        WHEN 'OPERADORES' THEN 'Operadores'
        WHEN 'MAQUINAS_Y_TIENDAS' THEN 'Maquinas'
        WHEN 'MAPA_MATERIA_PRIMA' THEN 'Maquinas::MapaMP'
        WHEN 'MAPA_CAFE_NRQ' THEN 'Maquinas::MapaNRQ'
        WHEN 'INGRESOS_BODEGA' THEN 'Inventario::Ingresos'
        WHEN 'DETALLE_INGRESOS' THEN 'Inventario::Detalle'
        WHEN 'PEDIDOS_OPERADOR' THEN 'Inventario::PedidosOperador'
        WHEN 'DESPACHOS_BODEGA' THEN 'Inventario::Despachos'
        WHEN 'TESORERIA_EFECTIVO_NR' THEN 'Tesoreria::EfectivoNR'
        WHEN 'TESORERIA_FACTURACION_NRQ' THEN 'Tesoreria::FacturacionNRQ'
        WHEN 'SALDOS_DIGITALES' THEN 'Tesoreria::SaldosDigitales'
        WHEN 'USUARIOS_SISTEMA' THEN 'Admin::Usuarios'
        WHEN 'ROLES_PERFILES' THEN 'Admin::Roles'
        ELSE 'General'
    END;

    v_campo_pk := CASE v_tabla
        WHEN 'CLIENTES' THEN 'ID_Cliente'
        WHEN 'PROVEEDORES' THEN 'ID_Proveedor'
        WHEN 'PRODUCTOS' THEN 'ID_Producto'
        WHEN 'RECETAS_DOSIFICADOS' THEN 'ID_Receta'
        WHEN 'PRECIOS_CLIENTE' THEN 'ID_Precio'
        WHEN 'OPERADORES' THEN 'ID_Operador'
        WHEN 'MAQUINAS_Y_TIENDAS' THEN 'ID_Maquina'
        WHEN 'MAPA_MATERIA_PRIMA' THEN 'ID_Mapa_MP'
        WHEN 'MAPA_CAFE_NRQ' THEN 'ID_Mapa_NRQ'
        WHEN 'INGRESOS_BODEGA' THEN 'ID_Ingreso'
        WHEN 'DETALLE_INGRESOS' THEN 'ID_Det_Ingreso'
        WHEN 'PEDIDOS_OPERADOR' THEN 'ID_Pedido'
        WHEN 'DESPACHOS_BODEGA' THEN 'ID_Despacho'
        WHEN 'TESORERIA_EFECTIVO_NR' THEN 'ID_Recaudo'
        WHEN 'TESORERIA_FACTURACION_NRQ' THEN 'ID_Fact_NRQ'
        WHEN 'SALDOS_DIGITALES' THEN 'ID_Saldo'
        WHEN 'USUARIOS_SISTEMA' THEN 'ID_Usuario'
        WHEN 'ROLES_PERFILES' THEN 'ID_Rol'
        ELSE NULL
    END;

    -- to_jsonb() es obligatorio (nunca ::jsonb sobre rowtype)
    v_old_row := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_new_row := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

    IF (v_campo_pk IS NOT NULL) THEN
        IF (TG_OP = 'DELETE') THEN
            v_id_registro := v_old_row ->> v_campo_pk;
        ELSE
            v_id_registro := v_new_row ->> v_campo_pk;
        END IF;
    ELSE
        v_id_registro := 'N/A';
    END IF;

    v_detalle := jsonb_build_object(
        'operacion', TG_OP,
        'antes',     v_old_row,
        'despues',   v_new_row
    );

    BEGIN
        v_usuario_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_usuario_id := NULL;
    END;

    BEGIN
        v_ip := NULLIF(current_setting('app.client_ip', TRUE), '');
    EXCEPTION WHEN OTHERS THEN
        v_ip := inet_client_addr()::TEXT;
    END;

    INSERT INTO public."AUDITORIA_LOG" (
        "ID_Usuario", "Modulo_Afectado", "Accion", "Tabla_Afectada",
        "ID_Registro_Afectado", "Detalle_Cambios", "IP_Origen"
    ) VALUES (
        v_usuario_id, v_modulo, TG_OP, v_tabla, v_id_registro, v_detalle, v_ip
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 3. TRIGGERS POR TABLA (AFTER INSERT OR UPDATE OR DELETE)
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_clientes ON "CLIENTES";
CREATE TRIGGER trg_audit_clientes AFTER INSERT OR UPDATE OR DELETE ON "CLIENTES" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_proveedores ON "PROVEEDORES";
CREATE TRIGGER trg_audit_proveedores AFTER INSERT OR UPDATE OR DELETE ON "PROVEEDORES" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_productos ON "PRODUCTOS";
CREATE TRIGGER trg_audit_productos AFTER INSERT OR UPDATE OR DELETE ON "PRODUCTOS" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_recetas ON "RECETAS_DOSIFICADOS";
CREATE TRIGGER trg_audit_recetas AFTER INSERT OR UPDATE OR DELETE ON "RECETAS_DOSIFICADOS" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_precios ON "PRECIOS_CLIENTE";
CREATE TRIGGER trg_audit_precios AFTER INSERT OR UPDATE OR DELETE ON "PRECIOS_CLIENTE" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_operadores ON "OPERADORES";
CREATE TRIGGER trg_audit_operadores AFTER INSERT OR UPDATE OR DELETE ON "OPERADORES" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_maquinas ON "MAQUINAS_Y_TIENDAS";
CREATE TRIGGER trg_audit_maquinas AFTER INSERT OR UPDATE OR DELETE ON "MAQUINAS_Y_TIENDAS" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_mapa_mp ON "MAPA_MATERIA_PRIMA";
CREATE TRIGGER trg_audit_mapa_mp AFTER INSERT OR UPDATE OR DELETE ON "MAPA_MATERIA_PRIMA" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_mapa_nrq ON "MAPA_CAFE_NRQ";
CREATE TRIGGER trg_audit_mapa_nrq AFTER INSERT OR UPDATE OR DELETE ON "MAPA_CAFE_NRQ" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_ingresos ON "INGRESOS_BODEGA";
CREATE TRIGGER trg_audit_ingresos AFTER INSERT OR UPDATE OR DELETE ON "INGRESOS_BODEGA" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_det_ingresos ON "DETALLE_INGRESOS";
CREATE TRIGGER trg_audit_det_ingresos AFTER INSERT OR UPDATE OR DELETE ON "DETALLE_INGRESOS" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_pedidos ON "PEDIDOS_OPERADOR";
CREATE TRIGGER trg_audit_pedidos AFTER INSERT OR UPDATE OR DELETE ON "PEDIDOS_OPERADOR" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_despachos ON "DESPACHOS_BODEGA";
CREATE TRIGGER trg_audit_despachos AFTER INSERT OR UPDATE OR DELETE ON "DESPACHOS_BODEGA" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_tes_efectivo ON "TESORERIA_EFECTIVO_NR";
CREATE TRIGGER trg_audit_tes_efectivo AFTER INSERT OR UPDATE OR DELETE ON "TESORERIA_EFECTIVO_NR" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_tes_fact ON "TESORERIA_FACTURACION_NRQ";
CREATE TRIGGER trg_audit_tes_fact AFTER INSERT OR UPDATE OR DELETE ON "TESORERIA_FACTURACION_NRQ" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_saldos ON "SALDOS_DIGITALES";
CREATE TRIGGER trg_audit_saldos AFTER INSERT OR UPDATE OR DELETE ON "SALDOS_DIGITALES" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_usuarios ON "USUARIOS_SISTEMA";
CREATE TRIGGER trg_audit_usuarios AFTER INSERT OR UPDATE OR DELETE ON "USUARIOS_SISTEMA" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

DROP TRIGGER IF EXISTS trg_audit_roles ON "ROLES_PERFILES";
CREATE TRIGGER trg_audit_roles AFTER INSERT OR UPDATE OR DELETE ON "ROLES_PERFILES" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger_generico();

-- --------------------------------------------------------------------------
-- 4. RLS: Permitir SELECT global sobre AUDITORIA_LOG (idempotente)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_select_all ON "AUDITORIA_LOG";
CREATE POLICY audit_log_select_all ON "AUDITORIA_LOG" FOR SELECT USING (true);