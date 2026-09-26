-- B2C-179: recalcular mano de obra por horas y conservar los campos de B2C-152.

CREATE OR REPLACE FUNCTION public._b2c179_tiene_permiso(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.plan_permissions pp ON pp.permission = rp.permission
    WHERE rp.role::text = auth.jwt() ->> 'user_role'
      AND rp.permission::text = p_permission
      AND rp.granted IS TRUE
      AND pp.plan::text = auth.jwt() ->> 'plan_sub'
      AND pp.granted IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public._b2c179_tiene_permiso(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._snapshot_detalle_arreglo_valores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_taller_id uuid;
  v_precio_hora numeric;
  v_empleado_tenant_id uuid;
  v_empleado_taller_id uuid;
  v_empleado_valor_hora numeric;
  v_puede_ver_costos boolean := public._b2c179_tiene_permiso('empleados:view');
  v_resolver_precio boolean;
BEGIN
  SELECT a.tenant_id, a.taller_id, t.valor_hora
    INTO v_tenant_id, v_taller_id, v_precio_hora
    FROM public.arreglos a
    LEFT JOIN public.talleres t ON t.id = a.taller_id AND t.tenant_id = a.tenant_id
   WHERE a.id = NEW.arreglo_id;

  IF v_tenant_id IS NULL OR NEW.tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'arreglo no encontrado para el tenant del detalle';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.horas_facturadas := COALESCE(NEW.horas_facturadas, 1);
    NEW.horas_trabajadas := COALESCE(NEW.horas_trabajadas, 1);
    v_resolver_precio := NEW.precio_hora_facturada IS NULL;
  ELSE
    v_resolver_precio := NEW.precio_hora_facturada IS NULL
      AND NEW.precio_hora_facturada IS DISTINCT FROM OLD.precio_hora_facturada;
  END IF;

  IF v_resolver_precio THEN
    NEW.precio_hora_facturada := COALESCE(v_precio_hora, 0);
  END IF;

  IF NEW.empleado_id IS NOT NULL THEN
    SELECT e.tenant_id, e.taller_id, e.valor_hora
      INTO v_empleado_tenant_id, v_empleado_taller_id, v_empleado_valor_hora
      FROM public.empleados e
     WHERE e.id = NEW.empleado_id;

    IF v_empleado_tenant_id IS NULL
       OR v_empleado_tenant_id IS DISTINCT FROM v_tenant_id
       OR v_empleado_taller_id IS DISTINCT FROM v_taller_id THEN
      RAISE EXCEPTION 'empleado no pertenece al tenant y taller del arreglo';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.valor_hora_empleado IS NULL OR NOT v_puede_ver_costos THEN
        NEW.valor_hora_empleado := v_empleado_valor_hora;
      END IF;
    ELSE
      IF NEW.empleado_id IS DISTINCT FROM OLD.empleado_id
         AND OLD.valor_hora_empleado IS NULL
         AND NEW.valor_hora_empleado IS NULL THEN
        NEW.valor_hora_empleado := v_empleado_valor_hora;
      ELSIF NOT v_puede_ver_costos
         AND NEW.valor_hora_empleado IS DISTINCT FROM OLD.valor_hora_empleado THEN
        IF NEW.empleado_id IS DISTINCT FROM OLD.empleado_id THEN
          NEW.valor_hora_empleado := v_empleado_valor_hora;
        ELSE
          NEW.valor_hora_empleado := OLD.valor_hora_empleado;
        END IF;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NOT v_puede_ver_costos
    AND NEW.valor_hora_empleado IS DISTINCT FROM OLD.valor_hora_empleado THEN
    NEW.valor_hora_empleado := NULL;
  ELSIF TG_OP = 'INSERT' AND NOT v_puede_ver_costos THEN
    NEW.valor_hora_empleado := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._snapshot_detalle_arreglo_valores()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_listar_empleados_valor_hora(p_taller_id uuid DEFAULT NULL)
RETURNS TABLE(empleado_id uuid, valor_hora numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'sesión autenticada requerida';
  END IF;
  IF NOT public._b2c179_tiene_permiso('empleados:view') THEN
    RAISE EXCEPTION 'permiso empleados:view requerido';
  END IF;

  RETURN QUERY
  SELECT e.id, e.valor_hora
  FROM public.empleados e
  WHERE e.tenant_id = v_tenant_id
    AND (p_taller_id IS NULL OR e.taller_id = p_taller_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_empleados_valor_hora(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_empleados_valor_hora(uuid) TO authenticated, service_role;

-- These costs are returned through permission-checked application APIs/RPCs.
-- Keep ordinary authenticated Data API reads from exposing them directly.
REVOKE SELECT ON public.empleados FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, taller_id, nombre, apellido, dni, email, telefono,
  cumpleanos, salario, fecha_ingreso, created_at, updated_at
) ON public.empleados TO authenticated;

REVOKE SELECT ON public.detalle_arreglo FROM anon, authenticated;
GRANT SELECT (
  id, tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada,
  horas_facturadas, horas_trabajadas, categoria_arreglo_id, empleado_id,
  iva_alicuota_id, created_at, updated_at
) ON public.detalle_arreglo TO authenticated;

CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo(p_arreglo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servicios numeric := 0;
  v_asignaciones numeric := 0;
  v_pendientes numeric := 0;
BEGIN
  SELECT coalesce(sum(CASE
    WHEN d.horas_facturadas IS NULL THEN d.cantidad * d.precio_hora_facturada
    ELSE d.horas_facturadas * d.precio_hora_facturada
  END), 0)
    INTO v_servicios
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id;

  SELECT coalesce(sum(ol.cantidad * ol.monto_unitario), 0)
    INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oaa
  JOIN public.operaciones_lineas ol ON ol.operacion_id = oaa.operacion_id
  WHERE oaa.arreglo_id = p_arreglo_id;

  SELECT coalesce(sum((x ->> 'cantidad')::numeric * (x ->> 'monto_unitario')::numeric), 0)
    INTO v_pendientes
  FROM public.arreglos a,
       jsonb_array_elements(coalesce(a.repuestos_pendientes, '[]'::jsonb)) x
  WHERE a.id = p_arreglo_id;

  RETURN v_servicios + v_asignaciones + v_pendientes;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle(p_arreglo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
  v_cobros jsonb;
  v_puede_ver_costos boolean := public._b2c179_tiene_permiso('empleados:view');
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT jsonb_build_object(
    'id', a.id, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
    'categoria', coalesce((SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) c_id JOIN public.categorias_arreglo ca ON ca.id = c_id), ''),
    'categorias', a.categorias, 'empleados', a.empleados,
    'empleados_detallados', public.arreglos_empleados_detallados(a),
    'estado', a.estado, 'descripcion', a.descripcion, 'kilometraje_leido', a.kilometraje_leido,
    'combustible_leido', a.combustible_leido, 'fecha', a.fecha, 'observaciones', a.observaciones,
    'precio_final', a.precio_final, 'precio_sin_iva', a.precio_sin_iva, 'esta_pago', a.esta_pago,
    'total_cobrado', a.total_cobrado,
    'saldo_pendiente', greatest(0, coalesce(a.precio_final, 0) - coalesce(a.total_cobrado, 0)),
    'extra_data', a.extra_data, 'cliente_id', a.cliente_id, 'es_facturable', a.es_facturable,
    'repuestos_pendientes', public._b2c152_publicar_pendientes(a.repuestos_pendientes)
  ) INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion,
    'cantidad', d.cantidad, 'precio_hora_facturada', d.precio_hora_facturada,
    'horas_facturadas', d.horas_facturadas, 'horas_trabajadas', d.horas_trabajadas,
    'valor_hora_empleado', CASE WHEN v_puede_ver_costos THEN d.valor_hora_empleado ELSE NULL END,
    'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
    'created_at', d.created_at, 'updated_at', d.updated_at
  ) ORDER BY d.created_at), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
    'lineas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
      'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
      'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
      'producto', jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre,
        'precio_unitario', p.precio_unitario, 'costo_unitario', p.costo_unitario,
        'proveedor', p.proveedor, 'categorias', coalesce(p.categorias, ARRAY[]::text[]))
    ) ORDER BY l.created_at) FROM public.operaciones_lineas l
      JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
      WHERE l.operacion_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', omc.operacion_id, 'operacion_id', omc.operacion_id, 'importe', omc.importe,
    'cuenta_id', omc.cuenta_id, 'cuenta_nombre', cf.nombre, 'descripcion', omc.descripcion,
    'fecha', o.fecha, 'created_at', omc.created_at
  ) ORDER BY o.fecha ASC, omc.created_at ASC), '[]'::jsonb) INTO v_cobros
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones o ON o.id = oca.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;

  RETURN jsonb_build_object('arreglo', v_arreglo, 'detalles', v_detalles,
    'asignaciones', v_asignaciones, 'cobros', v_cobros);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_arreglo_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_arreglo_detalle(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
