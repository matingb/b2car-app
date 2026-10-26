CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos     text[]                   DEFAULT NULL::text[],
  p_page      integer                  DEFAULT 1,
  p_page_size integer                  DEFAULT 50
)
  RETURNS TABLE (
    id                       uuid,
    tipo                     text,
    taller_id                uuid,
    fecha                    timestamp with time zone,
    created_at               timestamp with time zone,
    lineas                   jsonb,
    gasto_id                 uuid,
    descripcion              text,
    categoria_gasto          text,
    cuenta_financiera_id     uuid,
    cuenta_financiera_nombre text,
    monto                    numeric,
    monto_total              numeric,
    total_pagado             numeric,
    saldo_pendiente          numeric,
    esta_pago                boolean,
    estado_pago              text,
    estado_stock             text,
    arreglo_id               uuid,
    total_count              bigint,
    observaciones            text,
    proveedor_id             uuid,
    proveedor_nombre         text,
    cliente_id               uuid,
    cliente_nombre           text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  WITH rows AS (
    SELECT
      o.id,
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'cantidad_cumplida', l.cantidad_cumplida,
          'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad,
          'created_at', l.created_at, 'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO' AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        o.monto_total,
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0))::numeric AS saldo_pendiente,
      COALESCE(o.esta_pago, false) AS esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      COALESCE(NULLIF(TRIM(concat(part.nombre, ' ', COALESCE(part.apellido, ''))), ''), emp.nombre) AS cliente_nombre
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN LATERAL (
      SELECT m.cuenta_financiera_id, m.importe
      FROM public.movimientos_financieros AS m
      WHERE m.operacion_id = o.id AND m.tenant_id = o.tenant_id
      ORDER BY m.created_at, m.id
      LIMIT 1
    ) AS mf ON true
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.operaciones_venta AS ov ON ov.operacion_id = o.id
    LEFT JOIN public.particulares AS part ON part.id = ov.cliente_id
    LEFT JOIN public.empresas AS emp ON emp.id = ov.cliente_id
    LEFT JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores AS prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id, r.descripcion, r.categoria_gasto,
    r.cuenta_financiera_id, r.cuenta_financiera_nombre, r.monto,
    r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago, r.estado_pago, r.estado_stock,
    r.arreglo_id, COUNT(*) OVER() AS total_count, r.observaciones,
    r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "service_role";
REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) FROM "postgres";
GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp with time zone, timestamp with time zone, text[], integer, integer) TO "postgres";