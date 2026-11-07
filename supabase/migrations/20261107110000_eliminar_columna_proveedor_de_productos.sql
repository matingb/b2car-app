-- ============================================================================
-- Migración: Eliminar columna proveedor de public.productos con backfill a public.proveedores
-- y public.productos_proveedores.
--
-- 1. Si existiesen productos con texto en proveedor, se crea primero el registro en
--    public.proveedores (si no existe ya para ese tenant).
-- 2. Se asocia el producto al proveedor en public.productos_proveedores con su costo de referencia.
-- 3. Se actualiza rpc_get_arreglo_detalle para no depender de p.proveedor.
-- 4. Se elimina la columna proveedor de public.productos.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'proveedor'
  ) THEN
    -- 1. Crear proveedores inexistentes a partir del texto del producto
    INSERT INTO public.proveedores (tenant_id, nombre)
    SELECT DISTINCT ON (p.tenant_id, lower(btrim(p.proveedor)))
      p.tenant_id,
      btrim(p.proveedor) AS nombre
    FROM public.productos p
    WHERE p.proveedor IS NOT NULL
      AND btrim(p.proveedor) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.proveedores pr
        WHERE pr.tenant_id = p.tenant_id
          AND lower(btrim(pr.nombre)) = lower(btrim(p.proveedor))
      )
    ORDER BY p.tenant_id, lower(btrim(p.proveedor)), p.created_at ASC;

    -- 2. Vincular productos con su respectivo proveedor en productos_proveedores
    WITH proveedores_unicos AS (
      SELECT DISTINCT ON (tenant_id, lower(btrim(nombre)))
        id,
        tenant_id,
        lower(btrim(nombre)) AS nombre_norm
      FROM public.proveedores
      ORDER BY tenant_id, lower(btrim(nombre)), created_at ASC
    )
    INSERT INTO public.productos_proveedores (
      tenant_id,
      producto_id,
      proveedor_id,
      costo_referencia,
      es_predeterminado
    )
    SELECT
      p.tenant_id,
      p.id AS producto_id,
      pu.id AS proveedor_id,
      GREATEST(0::numeric, COALESCE(p.costo_unitario, 0::numeric)) AS costo_referencia,
      NOT EXISTS (
        SELECT 1
        FROM public.productos_proveedores pp
        WHERE pp.tenant_id = p.tenant_id
          AND pp.producto_id = p.id
          AND pp.es_predeterminado = true
      ) AS es_predeterminado
    FROM public.productos p
    JOIN proveedores_unicos pu
      ON pu.tenant_id = p.tenant_id
      AND pu.nombre_norm = lower(btrim(p.proveedor))
    WHERE p.proveedor IS NOT NULL
      AND btrim(p.proveedor) <> ''
    ON CONFLICT (tenant_id, producto_id, proveedor_id) DO NOTHING;
  END IF;
END $$;

-- 3. Actualizar función rpc_get_arreglo_detalle para no referenciar p.proveedor
CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle (
  p_arreglo_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
    'id', a.id, 'numero_orden', a.numero_orden, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
    'categoria', coalesce((SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) c_id JOIN public.categorias_arreglo ca ON ca.id = c_id), ''),
    'categorias', a.categorias, 'empleados', a.empleados,
    'empleados_detallados', public.arreglos_empleados_detallados(a),
    'estado', a.estado, 'descripcion', a.descripcion, 'kilometraje_leido', a.kilometraje_leido,
    'combustible_leido', a.combustible_leido, 'fecha', a.fecha, 'observaciones', a.observaciones,
    'precio_final', a.precio_final, 'precio_sin_iva', a.precio_sin_iva, 'esta_pago', a.esta_pago,
    'precios_incluyen_iva', a.precios_incluyen_iva, 'tasa_iva', a.tasa_iva,
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
        'categorias', coalesce(p.categorias, ARRAY[]::text[]))
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
  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones,
    'cobros', v_cobros
  );
END;
$function$;

-- 4. Eliminar la columna proveedor de public.productos
ALTER TABLE public.productos
  DROP COLUMN IF EXISTS proveedor;
