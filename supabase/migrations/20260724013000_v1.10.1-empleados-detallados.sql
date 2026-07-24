-- v1.10.1 - Columna Computada para obtener empleados detallados de arreglos

CREATE OR REPLACE FUNCTION public.arreglos_empleados_detallados(a public.arreglos)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', e.id, 'nombre', e.nombre, 'apellido', e.apellido)
    ), '[]'::jsonb
  )
  FROM unnest(a.empleados) AS emp_id
  JOIN public.empleados e ON e.id = emp_id;
$$;

GRANT EXECUTE ON FUNCTION public.arreglos_empleados_detallados(public.arreglos) TO authenticated, service_role;

-- ===========================================================================
-- Actualizar rpc_get_arreglo_detalle para que devuelva empleados_detallados
-- ===========================================================================

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
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT
    jsonb_build_object(
      'id', a.id,
      'vehiculo', to_jsonb(v),
      'taller_id', a.taller_id,
      'taller', to_jsonb(t),
      'categoria', COALESCE(
        (SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) AS c_id JOIN public.categorias_arreglo ca ON ca.id = c_id),
        ''
      ),
      'categorias', a.categorias,
      'empleados', a.empleados,
      'empleados_detallados', public.arreglos_empleados_detallados(a),
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
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id LIMIT 1;

  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
      'valor', d.valor, 'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
      'created_at', d.created_at, 'updated_at', d.updated_at
    ) ORDER BY d.created_at
  ), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
      'lineas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
            'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
            'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
            'producto', jsonb_build_object(
              'id', p.id, 'codigo', p.codigo, 'nombre', p.nombre, 'precio_unitario', p.precio_unitario,
              'costo_unitario', p.costo_unitario, 'proveedor', p.proveedor, 'categorias', COALESCE(p.categorias, ARRAY[]::text[])
            )
          ) ORDER BY l.created_at
        )
        FROM public.operaciones_lineas l JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at
  ), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa JOIN public.operaciones o ON o.id = oa.operacion_id WHERE oa.arreglo_id = p_arreglo_id;

  RETURN jsonb_build_object('arreglo', v_arreglo, 'detalles', v_detalles, 'asignaciones', v_asignaciones);
END;
$$;
