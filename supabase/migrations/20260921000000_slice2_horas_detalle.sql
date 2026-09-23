-- Migración: supabase/migrations/20260920_slice2_horas_detalle.sql

-- 1. Renombrar columna valor a precio_hora_facturada en detalle_arreglo
ALTER TABLE public.detalle_arreglo RENAME COLUMN valor TO precio_hora_facturada;

-- 2. Agregar columnas de horas
ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS horas_facturadas numeric(6,2) NOT NULL DEFAULT 1
    CHECK (horas_facturadas >= 0);

ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS horas_trabajadas numeric(6,2) NOT NULL DEFAULT 1
    CHECK (horas_trabajadas >= 0);

-- 3. Actualizar _insert_detalles_arreglo para usar precio_hora_facturada y horas
CREATE OR REPLACE FUNCTION public._insert_detalles_arreglo(
  p_arreglo_id uuid,
  p_detalles jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_item jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_detalles IS NULL OR jsonb_array_length(p_detalles) = 0 THEN RETURN; END IF;

  PERFORM 1 FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'arreglo no encontrado'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.detalle_arreglo (
      tenant_id, arreglo_id, descripcion, cantidad, precio_hora_facturada,
      horas_facturadas, horas_trabajadas, categoria_arreglo_id, empleado_id
    ) VALUES (
      v_tenant_id, p_arreglo_id, trim(coalesce(v_item ->> 'descripcion', '')),
      COALESCE(NULLIF(v_item ->> 'cantidad', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'precio_hora_facturada', '')::numeric, 0),
      COALESCE(NULLIF(v_item ->> 'horas_facturadas', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'horas_trabajadas', '')::numeric, 1),
      NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      NULLIF(v_item ->> 'empleado_id', '')::uuid
    );
  END LOOP;
END;
$$;

-- 4. Actualizar rpc_get_arreglo_detalle
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
  v_cobros jsonb;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;

  SELECT jsonb_build_object(
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
    'combustible_leido', a.combustible_leido,
    'fecha', a.fecha,
    'observaciones', a.observaciones,
    'precio_final', a.precio_final,
    'precio_sin_iva', a.precio_sin_iva,
    'esta_pago', a.esta_pago,
    'total_cobrado', a.total_cobrado,
    'saldo_pendiente', GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)),
    'extra_data', a.extra_data
  )
  INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_arreglo IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
      'precio_hora_facturada', d.precio_hora_facturada,
      'horas_facturadas', d.horas_facturadas,
      'horas_trabajadas', d.horas_trabajadas,
      'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
      'created_at', d.created_at, 'updated_at', d.updated_at
    ) ORDER BY d.created_at
  ), '[]'::jsonb)
  INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;

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
        FROM public.operaciones_lineas l
        JOIN public.stocks s ON s.id = l.stock_id
        JOIN public.productos p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at
  ), '[]'::jsonb)
  INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', omc.operacion_id,
      'operacion_id', omc.operacion_id,
      'importe', omc.importe,
      'cuenta_id', omc.cuenta_id,
      'cuenta_nombre', cf.nombre,
      'descripcion', omc.descripcion,
      'fecha', o.fecha,
      'created_at', omc.created_at
    ) ORDER BY o.fecha ASC, omc.created_at ASC
  ), '[]'::jsonb)
  INTO v_cobros
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
$$;

-- 5. Actualizar función de recálculo de precio final
CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo(p_arreglo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_servicios numeric := 0;
  v_total_asignaciones numeric := 0;
BEGIN
  -- Suma de servicios (cantidad * horas_facturadas * precio_hora_facturada)
  SELECT COALESCE(SUM(cantidad * horas_facturadas * precio_hora_facturada), 0)
  INTO v_total_servicios
  FROM public.detalle_arreglo
  WHERE arreglo_id = p_arreglo_id;

  -- Suma de asignaciones (operaciones_lineas via operaciones_asignacion_arreglo)
  SELECT COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)
  INTO v_total_asignaciones
  FROM public.operaciones_asignacion_arreglo oaa
  JOIN public.operaciones_lineas ol ON ol.operacion_id = oaa.operacion_id
  WHERE oaa.arreglo_id = p_arreglo_id;

  RETURN v_total_servicios + v_total_asignaciones;
END;
$$;

-- 6. Actualizar dashboard_sum_ingresos
CREATE OR REPLACE FUNCTION public.dashboard_sum_ingresos(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS numeric
LANGUAGE sql
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(d.cantidad * d.horas_facturadas * d.precio_hora_facturada), 0)::numeric
  FROM public.arreglos a
  JOIN public.detalle_arreglo d ON d.arreglo_id = a.id
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$$;

-- 7. Actualizar dashboard_facturacion_por_categoria
CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_categoria(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.categoria_arreglo_id AS cat_id, (d.cantidad * d.horas_facturadas * d.precio_hora_facturada)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')

    UNION ALL

    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(c.nombre, 'Sin categoría')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;

-- 8. Actualizar dashboard_facturacion_por_empleado
CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_empleado(
  top         integer     DEFAULT 6,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE sql
SET search_path = public
AS $$
  WITH lineas AS (
    SELECT d.empleado_id AS empleado_id, (d.cantidad * d.horas_facturadas * d.precio_hora_facturada)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')

    UNION ALL

    SELECT ol.empleado_id AS empleado_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(e.nombre || ' ' || e.apellido, 'Sin empleado')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.empleados e ON e.id = l.empleado_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$$;
