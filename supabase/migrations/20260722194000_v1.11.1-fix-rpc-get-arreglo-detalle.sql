-- v1.11.1 - Fix RPCs that referenced a.tipo after its removal

-- 1. Fix rpc_get_arreglo_detalle
DROP FUNCTION IF EXISTS public.rpc_get_arreglo_detalle(uuid);

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(
  p_arreglo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido';
  END IF;

  SELECT
    jsonb_build_object(
      'id', a.id,
      'vehiculo', to_jsonb(v),
      'taller_id', a.taller_id,
      'taller', to_jsonb(t),
      'tipo', COALESCE(
        (SELECT string_agg(ta.nombre, ', ')
         FROM unnest(a.tipos) AS t_id
         JOIN public.tipos_arreglo ta ON ta.id = t_id),
        ''
      ),
      'tipos', a.tipos,
      'empleados', a.empleados,
      'estado', a.estado,
      'descripcion', a.descripcion,
      'kilometraje_leido', a.kilometraje_leido,
      'fecha', a.fecha,
      'observaciones', a.observaciones,
      'precio_final', a.precio_final,
      'precio_sin_iva', a.precio_sin_iva,
      'esta_pago', a.esta_pago,
      'extra_data', a.extra_data
    )
  INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_arreglo IS NULL THEN
    RETURN NULL;
  END IF;

  -- Servicios (detalle_arreglo)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'arreglo_id', d.arreglo_id,
        'descripcion', d.descripcion,
        'cantidad', d.cantidad,
        'valor', d.valor,
        'tipo_arreglo_id', d.tipo_arreglo_id,
        'empleado_id', d.empleado_id,
        'created_at', d.created_at,
        'updated_at', d.updated_at
      )
      ORDER BY d.created_at
    ),
    '[]'::jsonb
  )
  INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id
    AND d.tenant_id = v_tenant_id;

  -- Repuestos (operaciones asignación arreglo) + líneas + producto via stock
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'tipo', o.tipo,
        'taller_id', o.taller_id,
        'created_at', o.created_at,
        'lineas', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', l.id,
              'operacion_id', l.operacion_id,
              'stock_id', l.stock_id,
              'cantidad', l.cantidad,
              'monto_unitario', l.monto_unitario,
              'delta_cantidad', l.delta_cantidad,
              'created_at', l.created_at,
              'tipo_arreglo_id', l.tipo_arreglo_id,
              'empleado_id', l.empleado_id,
              'producto', jsonb_build_object(
                'id', p.id,
                'codigo', p.codigo,
                'nombre', p.nombre,
                'precio_unitario', p.precio_unitario,
                'costo_unitario', p.costo_unitario,
                'proveedor', p.proveedor,
                'categorias', COALESCE(p.categorias, ARRAY[]::text[])
              )
            )
            ORDER BY l.created_at
          )
          FROM public.operaciones_lineas l
          JOIN public.stocks s ON s.id = l.stock_id
          JOIN public.productos p ON p.id = s.producto_id
          WHERE l.operacion_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at
    ),
    '[]'::jsonb
  )
  INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;

  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones
  );
END;
$$;


-- 2. Fix dashboard_tipos_con_ingresos
CREATE OR REPLACE FUNCTION public.dashboard_tipos_con_ingresos(
  top         integer     DEFAULT 4,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(tipo text, cantidad integer, ingresos numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      COALESCE(
        (SELECT string_agg(ta.nombre, ', ')
         FROM unnest(a.tipos) AS t_id
         JOIN public.tipos_arreglo ta ON ta.id = t_id),
        'Sin tipo'
      )::text AS tipo,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(a.precio_final), 0)::numeric AS ingresos
    FROM public.arreglos a
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  ),
  ranked AS (
    SELECT a.tipo, a.cantidad, a.ingresos,
           ROW_NUMBER() OVER (ORDER BY a.cantidad DESC, a.tipo ASC) AS rn
    FROM agg a
  ),
  top_rows AS (
    SELECT tipo, cantidad, ingresos
    FROM ranked
    WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS tipo,
           COALESCE(SUM(cantidad), 0)::int AS cantidad,
           COALESCE(SUM(ingresos), 0)::numeric AS ingresos
    FROM ranked
    WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.tipo, s.cantidad, s.ingresos
  FROM (
    SELECT tipo, cantidad, ingresos, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT tipo, cantidad, ingresos, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.cantidad DESC, s.tipo ASC;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_tipos_con_ingresos(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
