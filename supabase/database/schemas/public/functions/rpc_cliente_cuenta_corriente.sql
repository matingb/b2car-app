CREATE FUNCTION public.rpc_cliente_cuenta_corriente (
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
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro registrado') || ' (' || COALESCE(v.patente, '') || ')' AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      COALESCE(omc.importe, 0)::numeric                           AS credito,
      a.id                                                        AS arreglo_id,
      oca.operacion_id                                            AS operacion_id,
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
      AND o.tipo = 'VENTA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre ventas del cliente
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      ABS(COALESCE(omc.importe, 0))::numeric                      AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_venta ov ON ov.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'::public.tipo_operacion
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

REVOKE ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp WITH time zone, timestamp WITH time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp WITH time zone, timestamp WITH time zone) TO anon;

GRANT ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp WITH time zone, timestamp WITH time zone) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp WITH time zone, timestamp WITH time zone) TO service_role;