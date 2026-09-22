const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const PATCH = `
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
    v_old_json     JSONB;
    v_new_json     JSONB;
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

    IF (v_campo_pk IS NOT NULL) THEN
        IF (TG_OP = 'DELETE') THEN
            v_id_registro := OLD::jsonb ->> v_campo_pk;
        ELSE
            v_id_registro := NEW::jsonb ->> v_campo_pk;
        END IF;
    ELSE
        v_id_registro := 'N/A';
    END IF;

    v_old_json := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_new_json := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_detalle  := jsonb_build_object(
        'operacion', TG_OP,
        'antes',     v_old_json,
        'despues',   v_new_json
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
        "ID_Usuario",
        "Modulo_Afectado",
        "Accion",
        "Tabla_Afectada",
        "ID_Registro_Afectado",
        "Detalle_Cambios",
        "IP_Origen"
    ) VALUES (
        v_usuario_id,
        v_modulo,
        TG_OP,
        v_tabla,
        v_id_registro,
        v_detalle,
        v_ip
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
`;

(async () => {
  try {
    console.log('🔧 Aplicando parche: fn_audit_trigger_generico (search_path fix)...');
    await p.$executeRawUnsafe(PATCH);
    await p.$executeRawUnsafe(`ALTER FUNCTION public.fn_audit_trigger_generico() OWNER TO postgres`);
    await p.$executeRawUnsafe(`REVOKE ALL ON FUNCTION public.fn_audit_trigger_generico() FROM PUBLIC`);
    await p.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.fn_audit_trigger_generico() TO postgres`);
    await p.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION public.fn_audit_trigger_generico() TO PUBLIC`);
    console.log('✅ Parche aplicado OK. search_path = public, pg_catalog, pg_temp');
  } catch (e) {
    console.error('❌ ERROR aplicando parche:', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
