-- ============================================================================
-- MIGRATION: 20260908230000_cliente_cuenta_corriente_y_facturable.sql
-- Linkeo directo de arreglos a clientes, bandera es_facturable,
-- RPC de resumen financiero (saldo deuda y saldo a facturar) y cuenta corriente.
-- ============================================================================

-- 1. Columnas en public.arreglos
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS es_facturable boolean NOT NULL DEFAULT true;

-- 2. Backfill de cliente_id desde vehiculos para arreglos históricos
UPDATE public.arreglos a
SET cliente_id = v.cliente_id
FROM public.vehiculos v
WHERE a.vehiculo_id = v.id
  AND a.cliente_id IS NULL;

-- 3. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_arreglos_tenant_cliente
  ON public.arreglos (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_arreglos_tenant_facturable
  ON public.arreglos (tenant_id, es_facturable);

-- 4. Trigger para autoasignar cliente_id desde vehiculos si no viene provisto
CREATE OR REPLACE FUNCTION public._sync_arreglo_cliente_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.cliente_id IS NULL AND NEW.vehiculo_id IS NOT NULL THEN
    SELECT v.cliente_id INTO NEW.cliente_id
    FROM public.vehiculos v
    WHERE v.id = NEW.vehiculo_id;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public._sync_arreglo_cliente_id() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_arreglo_cliente_id ON public.arreglos;
CREATE TRIGGER trg_sync_arreglo_cliente_id
  BEFORE INSERT OR UPDATE OF vehiculo_id ON public.arreglos
  FOR EACH ROW EXECUTE FUNCTION public._sync_arreglo_cliente_id();

-- 4.b Trigger para propagar cambios de cliente_id en vehiculos hacia sus arreglos
CREATE OR REPLACE FUNCTION public._sync_vehiculo_cliente_id_to_arreglos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
    UPDATE public.arreglos
    SET cliente_id = NEW.cliente_id
    WHERE vehiculo_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public._sync_vehiculo_cliente_id_to_arreglos() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_vehiculo_cliente_id_to_arreglos ON public.vehiculos;
CREATE TRIGGER trg_sync_vehiculo_cliente_id_to_arreglos
  AFTER UPDATE OF cliente_id ON public.vehiculos
  FOR EACH ROW EXECUTE FUNCTION public._sync_vehiculo_cliente_id_to_arreglos();

-- 5. RPC: rpc_cliente_resumen_financiero
DROP FUNCTION IF EXISTS public.rpc_cliente_resumen_financiero(uuid);

CREATE OR REPLACE FUNCTION public.rpc_cliente_resumen_financiero(
  p_cliente_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id                  uuid := public.current_tenant_id();
  v_saldo_cuenta               numeric := 0;
  v_saldo_a_facturar           numeric := 0;
  v_total_historico_trabajos   numeric := 0;
  v_total_historico_cobrado    numeric := 0;
  v_cant_pendientes_pago       integer := 0;
  v_cant_pendientes_factura    integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'cliente_id requerido' USING ERRCODE = '22023'; END IF;

  -- 1. Totales de cuenta / cobro (excluyendo PRESUPUESTO)
  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COALESCE(SUM(COALESCE(a.total_cobrado, 0)), 0),
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))), 0),
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.precio_final, 0) > COALESCE(a.total_cobrado, 0))::integer
  INTO
    v_total_historico_trabajos,
    v_total_historico_cobrado,
    v_saldo_cuenta,
    v_cant_pendientes_pago
  FROM public.arreglos a
  WHERE a.tenant_id = v_tenant_id
    AND a.cliente_id = p_cliente_id
    AND a.estado != 'PRESUPUESTO';

  -- 2. Saldo a facturar: arreglos del cliente facturables sin factura autorizada
  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COUNT(*)::integer
  INTO
    v_saldo_a_facturar,
    v_cant_pendientes_factura
  FROM public.arreglos a
  WHERE a.tenant_id = v_tenant_id
    AND a.cliente_id = p_cliente_id
    AND a.estado != 'PRESUPUESTO'
    AND a.es_facturable = true
    AND COALESCE(a.precio_final, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas fe
      WHERE fe.tenant_id = v_tenant_id
        AND fe.arreglo_id = a.id
        AND fe.estado = 'AUTORIZADA'
    );

  RETURN jsonb_build_object(
    'saldo_cuenta',                         v_saldo_cuenta,
    'saldo_a_facturar',                     v_saldo_a_facturar,
    'total_historico_trabajos',             v_total_historico_trabajos,
    'total_historico_cobrado',              v_total_historico_cobrado,
    'cantidad_arreglos_pendientes_pago',    v_cant_pendientes_pago,
    'cantidad_arreglos_pendientes_factura', v_cant_pendientes_factura
  );
END; $$;

REVOKE ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO authenticated, service_role;

-- 6. RPC: rpc_cliente_cuenta_corriente
DROP FUNCTION IF EXISTS public.rpc_cliente_cuenta_corriente(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.rpc_cliente_cuenta_corriente(
  p_cliente_id uuid,
  p_from       timestamptz DEFAULT NULL,
  p_to         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  fecha            timestamptz,
  created_at       timestamptz,
  tipo_movimiento  text,
  concepto         text,
  comprobante      text,
  debito           numeric,
  credito          numeric,
  arreglo_id       uuid,
  operacion_id     uuid,
  cuenta_nombre    text
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH movimientos AS (
    -- CARGOS: Arreglos no presupuestos
    SELECT
      a.id                                                        AS id,
      a.fecha                                                     AS fecha,
      a.created_at                                                AS created_at,
      'CARGO_ARREGLO'::text                                       AS tipo_movimiento,
      COALESCE(NULLIF(btrim(a.descripcion), ''), 'Arreglo de vehículo') || ' - ' || COALESCE(v.patente, '') AS concepto,
      (
        SELECT fe.clase_comprobante || ' ' || LPAD(fe.punto_venta::text, 4, '0') || '-' || LPAD(fe.numero_comprobante::text, 8, '0')
        FROM public.facturas_electronicas fe
        WHERE fe.arreglo_id = a.id AND fe.tenant_id = a.tenant_id AND fe.estado = 'AUTORIZADA'
        LIMIT 1
      )                                                           AS comprobante,
      COALESCE(a.precio_final, 0)::numeric                        AS debito,
      0::numeric                                                  AS credito,
      a.id                                                        AS arreglo_id,
      NULL::uuid                                                  AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND a.cliente_id = p_cliente_id
      AND a.estado != 'PRESUPUESTO'

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre arreglos del cliente
    SELECT
      omc.operacion_id                                            AS id,
      o.fecha                                                     AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro registrado') || ' (' || COALESCE(v.patente, '') || ')' AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      COALESCE(omc.importe, 0)::numeric                           AS credito,
      a.id                                                        AS arreglo_id,
      omc.operacion_id                                            AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_cobro_arreglo oca
    JOIN public.arreglos a ON a.id = oca.arreglo_id
    JOIN public.operaciones o ON o.id = oca.operacion_id
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE oca.tenant_id = (SELECT public.current_tenant_id())
      AND a.cliente_id = p_cliente_id
  )
  SELECT
    m.id,
    m.fecha,
    m.created_at,
    m.tipo_movimiento,
    m.concepto,
    m.comprobante,
    m.debito,
    m.credito,
    m.arreglo_id,
    m.operacion_id,
    m.cuenta_nombre
  FROM movimientos m
  WHERE (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamptz, timestamptz) TO authenticated, service_role;
