CREATE FUNCTION public.rpc_listar_operaciones_con_gastos (
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
      o.tipo::text AS tipo,
      o.taller_id,
      o.fecha,
      o.created_at,
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
      CASE WHEN o.tipo = 'GASTO'::public.tipo_operacion THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN o.tipo = 'AJUSTE'::public.tipo_operacion AND oaj.motivo = 'DEVOLUCION_NC' THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
          'Transferencia de ' || COALESCE(c_orig.nombre, '') || ' a ' || COALESCE(c_dest.nombre, '')
        WHEN o.tipo = 'INGRESO'::public.tipo_operacion THEN
          COALESCE(oi.concepto, 'Ingreso a ' || COALESCE(c_ing.nombre, ''))
        WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN
          'Apertura de cuenta ' || COALESCE(c_aper.nombre, '')
        WHEN o.tipo = 'AJUSTE_FINANCIERO'::public.tipo_operacion THEN oaf.descripcion
        WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
          'Cobro arreglo ' || COALESCE(v_cob.patente, '')
        ELSE COALESCE(og.descripcion, o.observaciones)
      END AS descripcion,
      og.categoria_gasto,
      COALESCE(oi.cuenta_id, oap.cuenta_id, ot.cuenta_origen_id, oaf.cuenta_id) AS cuenta_financiera_id,
      COALESCE(c_ing.nombre, c_aper.nombre, c_orig.nombre, c_ajuste.nombre) AS cuenta_financiera_nombre,
      o.monto_total AS monto,
      o.monto_total,
      o.total_pagado,
      GREATEST(0, COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)) AS saldo_pendiente,
      o.esta_pago,
      o.estado_pago::text AS estado_pago,
      o.estado_stock::text AS estado_stock,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id,
      o.observaciones,
      oc.proveedor_id,
      prov.nombre AS proveedor_nombre,
      ov.cliente_id,
      CASE
        WHEN cl.tipo_cliente = 'empresa' THEN emp.nombre
        WHEN cl.tipo_cliente = 'particular' THEN TRIM(part.nombre || ' ' || part.apellido)
        ELSE NULL
      END AS cliente_nombre
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_gasto og ON og.operacion_id = o.id
    LEFT JOIN public.operaciones_ingreso oi ON oi.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_ing ON c_ing.id = oi.cuenta_id
    LEFT JOIN public.operaciones_transferencia ot ON ot.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_orig ON c_orig.id = ot.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras c_dest ON c_dest.id = ot.cuenta_destino_id
    LEFT JOIN public.operaciones_apertura_cuenta oap ON oap.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_aper ON c_aper.id = oap.cuenta_id
    LEFT JOIN public.operaciones_ajuste_financiero oaf ON oaf.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras c_ajuste ON c_ajuste.id = oaf.cuenta_id
    LEFT JOIN public.operaciones_ajuste oaj ON oaj.operacion_id = o.id
    LEFT JOIN public.operaciones_cobro_arreglo oca ON oca.operacion_id = o.id
    LEFT JOIN public.arreglos a_cob ON a_cob.id = oca.arreglo_id
    LEFT JOIN public.vehiculos v_cob ON v_cob.id = a_cob.vehiculo_id
    LEFT JOIN public.operaciones_asignacion_arreglo oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos a ON a.id = oaa.arreglo_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    LEFT JOIN public.operaciones_compra oc ON oc.operacion_id = o.id
    LEFT JOIN public.proveedores prov ON prov.id = oc.proveedor_id
    LEFT JOIN public.operaciones_venta ov ON ov.operacion_id = o.id
    LEFT JOIN public.clientes cl ON cl.id = ov.cliente_id
    LEFT JOIN public.empresas emp ON emp.id = ov.cliente_id
    LEFT JOIN public.particulares part ON part.id = ov.cliente_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (
        COALESCE(cardinality(p_tipos), 0) = 0
        OR o.tipo::text = ANY(p_tipos)
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM rows
  )
  SELECT
    r.id, r.tipo, r.taller_id, r.fecha, r.created_at, r.lineas, r.gasto_id,
    r.descripcion, r.categoria_gasto, r.cuenta_financiera_id, r.cuenta_financiera_nombre,
    r.monto, r.monto_total, r.total_pagado, r.saldo_pendiente, r.esta_pago,
    r.estado_pago, r.estado_stock, r.arreglo_id, c.total AS total_count,
    r.observaciones, r.proveedor_id, r.proveedor_nombre, r.cliente_id, r.cliente_nombre
  FROM rows r
  CROSS JOIN counted c
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 500)
  OFFSET GREATEST((COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO anon;

GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO service_role;