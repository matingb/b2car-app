-- Incluye la cuenta del asiento financiero que respalda cada compra o venta
-- dentro de la misma proyección que alimenta el listado de operaciones.
CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_tipos text[] DEFAULT NULL, p_page int DEFAULT 1, p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid, tipo text, taller_id uuid, fecha timestamptz, created_at timestamptz,
  lineas jsonb, gasto_id uuid, descripcion text, categoria_gasto text,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text, monto numeric,
  arreglo_id uuid, total_count bigint
)
LANGUAGE sql STABLE SET search_path = '' AS $$
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
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
          'nombre', p.nombre, 'codigo', p.codigo
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
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
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
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT r.*, COUNT(*) OVER() AS total_count
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) TO authenticated, service_role;
