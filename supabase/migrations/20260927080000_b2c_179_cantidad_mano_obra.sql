-- B2C-179: la cantidad de mano de obra vuelve a multiplicar las horas facturadas.

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
    ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada
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

-- Actualizar el total guardado solo donde la nueva multiplicidad modifica importes.
-- Las facturas autorizadas conservan su importe fiscal inmutable.
UPDATE public.arreglos a
SET precio_final = public.calcular_precio_final_arreglo(a.id)
WHERE NOT public.facturacion_arreglo_autorizado(a.id)
  AND EXISTS (
    SELECT 1
    FROM public.detalle_arreglo d
    WHERE d.arreglo_id = a.id
      AND d.horas_facturadas IS NOT NULL
      AND d.cantidad <> 1
  )
  AND a.precio_final IS DISTINCT FROM public.calcular_precio_final_arreglo(a.id);

CREATE OR REPLACE FUNCTION public.dashboard_sum_ingresos(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS numeric
LANGUAGE sql
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(CASE WHEN d.horas_facturadas IS NULL
    THEN d.cantidad * d.precio_hora_facturada
    ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END), 0)::numeric
  FROM public.arreglos a
  JOIN public.detalle_arreglo d ON d.arreglo_id = a.id
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$$;

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
    SELECT d.categoria_arreglo_id AS cat_id, (CASE WHEN d.horas_facturadas IS NULL
      THEN d.cantidad * d.precio_hora_facturada
      ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END)::numeric AS monto
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
    SELECT d.empleado_id AS empleado_id, (CASE WHEN d.horas_facturadas IS NULL
      THEN d.cantidad * d.precio_hora_facturada
      ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END)::numeric AS monto
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
