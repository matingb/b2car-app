-- ============================================================================
-- MIGRATION: 20261027140000_unificar_cliente_resumen_financiero_vehiculos.sql
-- Asegurar que el cálculo de saldos de clientes (arreglos + ventas de productos)
-- esté unificado en PostgreSQL mediante la función batch rpc_clientes_saldos,
-- consumida tanto por el listado de clientes como por rpc_cliente_resumen_financiero.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_clientes_saldos (
  p_cliente_ids uuid[] DEFAULT NULL
)
  RETURNS TABLE (
    cliente_id uuid,
    saldo      numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  WITH arreglos_saldo AS (
    SELECT
      COALESCE(a.cliente_id, v.cliente_id) AS cliente_id,
      COALESCE(SUM(COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)), 0) AS saldo
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND a.estado != 'PRESUPUESTO'
      AND (p_cliente_ids IS NULL OR COALESCE(a.cliente_id, v.cliente_id) = ANY(p_cliente_ids))
    GROUP BY COALESCE(a.cliente_id, v.cliente_id)
  ),
  ventas_saldo AS (
    SELECT
      ov.cliente_id,
      COALESCE(SUM(COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)), 0) AS saldo
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'VENTA'
      AND (p_cliente_ids IS NULL OR ov.cliente_id = ANY(p_cliente_ids))
    GROUP BY ov.cliente_id
  ),
  saldos_unificados AS (
    SELECT cliente_id, saldo FROM arreglos_saldo
    UNION ALL
    SELECT cliente_id, saldo FROM ventas_saldo
  )
  SELECT
    c.id AS cliente_id,
    COALESCE(SUM(su.saldo), 0)::numeric AS saldo
  FROM public.clientes c
  LEFT JOIN saldos_unificados su ON su.cliente_id = c.id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
    AND (p_cliente_ids IS NULL OR c.id = ANY(p_cliente_ids))
  GROUP BY c.id;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_clientes_saldos(uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_cliente_resumen_financiero (
  p_cliente_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id                  uuid := public.current_tenant_id();
  v_saldo_cuenta               numeric := 0;
  v_saldo_a_facturar           numeric := 0;
  v_total_historico_trabajos   numeric := 0;
  v_total_historico_cobrado    numeric := 0;
  v_cant_pendientes_pago       integer := 0;
  v_cant_pendientes_factura    integer := 0;

  v_total_ventas               numeric := 0;
  v_cobrado_ventas             numeric := 0;
  v_cant_ventas_pendientes     integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id requerido' USING ERRCODE = '22023';
  END IF;

  -- 1. Arreglos (vinculados directamente o mediante el vehículo asociado)
  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COALESCE(SUM(COALESCE(a.total_cobrado, 0)), 0),
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.precio_final, 0) > COALESCE(a.total_cobrado, 0))::integer
  INTO
    v_total_historico_trabajos,
    v_total_historico_cobrado,
    v_cant_pendientes_pago
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.tenant_id = v_tenant_id
    AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
    AND a.estado != 'PRESUPUESTO';

  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COUNT(*)::integer
  INTO
    v_saldo_a_facturar,
    v_cant_pendientes_factura
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.tenant_id = v_tenant_id
    AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
    AND a.estado != 'PRESUPUESTO'
    AND a.es_facturable = true
    AND COALESCE(a.precio_final, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas fe
      WHERE fe.tenant_id = v_tenant_id
        AND fe.arreglo_id = a.id
        AND fe.estado = 'AUTORIZADA'
    );

  -- 2. Ventas directas de productos
  SELECT
    COALESCE(SUM(COALESCE(o.monto_total, 0)), 0),
    COALESCE(SUM(COALESCE(o.total_pagado, 0)), 0),
    COUNT(*) FILTER (WHERE o.esta_pago = false AND COALESCE(o.monto_total, 0) > COALESCE(o.total_pagado, 0))::integer
  INTO
    v_total_ventas,
    v_cobrado_ventas,
    v_cant_ventas_pendientes
  FROM public.operaciones_venta ov
  JOIN public.operaciones o ON o.id = ov.operacion_id
  WHERE ov.tenant_id = v_tenant_id
    AND ov.cliente_id = p_cliente_id
    AND o.tipo = 'VENTA';

  v_total_historico_trabajos := v_total_historico_trabajos + v_total_ventas;
  v_total_historico_cobrado := v_total_historico_cobrado + v_cobrado_ventas;
  v_cant_pendientes_pago := v_cant_pendientes_pago + v_cant_ventas_pendientes;

  -- 3. Saldo unificado de cuenta corriente (desde rpc_clientes_saldos)
  SELECT COALESCE(s.saldo, 0)
  INTO v_saldo_cuenta
  FROM public.rpc_clientes_saldos(ARRAY[p_cliente_id]) s;

  RETURN jsonb_build_object(
    'saldo_cuenta',                         v_saldo_cuenta,
    'saldo_a_facturar',                     v_saldo_a_facturar,
    'total_historico_trabajos',             v_total_historico_trabajos,
    'total_historico_cobrado',              v_total_historico_cobrado,
    'cantidad_arreglos_pendientes_pago',    v_cant_pendientes_pago,
    'cantidad_arreglos_pendientes_factura', v_cant_pendientes_factura
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_cliente_cuenta_corriente (
  p_cliente_id uuid,
  p_from       timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to         timestamp with time zone DEFAULT NULL::timestamp WITH time zone
)
  RETURNS TABLE (
    id              uuid,
    fecha           timestamp with time zone,
    created_at      timestamp with time zone,
    tipo_movimiento text,
    concepto        text,
    comprobante     text,
    debito          numeric,
    credito         numeric,
    arreglo_id      uuid,
    operacion_id    uuid,
    cuenta_nombre   text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
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
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
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
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id

    UNION ALL

    -- CARGOS: Ventas de productos al cliente
    SELECT
      o.id                                                        AS id,
      o.fecha                                                     AS fecha,
      o.created_at                                                AS created_at,
      'CARGO_VENTA'::text                                         AS tipo_movimiento,
      COALESCE(NULLIF(btrim(o.observaciones), ''), 'Venta de productos #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      COALESCE(o.monto_total, 0)::numeric                         AS debito,
      0::numeric                                                  AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'

    UNION ALL

    -- CRÉDITOS: Pagos registrados sobre ventas del cliente
    SELECT
      op.id                                                       AS id,
      op.fecha                                                    AS fecha,
      op.created_at                                               AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(op.descripcion), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      COALESCE(op.monto, 0)::numeric                              AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_pagos op
    JOIN public.operaciones_venta ov ON ov.operacion_id = op.operacion_id
    JOIN public.operaciones o ON o.id = op.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = op.cuenta_financiera_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'
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
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) TO anon, authenticated, service_role;
