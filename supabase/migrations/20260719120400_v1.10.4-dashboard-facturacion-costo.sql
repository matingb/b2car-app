-- v1.10.4 - Desgloses de dashboard por tipo/empleado a nivel de linea.
-- Reemplaza dashboard_tipos_con_ingresos (agregaba por arreglos.tipo, un valor
-- por arreglo completo) por 4 RPCs nuevas que agregan a nivel de linea
-- (detalle_arreglo + operaciones_lineas), todas con la misma forma de salida
-- (label, cantidad, monto) para alimentar un componente de grafico generico.
--
-- - facturacion_por_tipo/empleado: mano de obra + repuestos (lo facturado).
-- - costo_por_tipo: solo costo de repuestos (productos.costo_unitario). El
--   sueldo no tiene dimension "tipo" y, por decision explicita, no se
--   prorratea.
-- - costo_por_empleado: costo de repuestos atribuidos a ese empleado + su
--   sueldo vigente en el periodo (misma fuente que dashboard_gastos_por_periodo,
--   ahora desagregada por empleado).

DROP FUNCTION IF EXISTS public.dashboard_tipos_con_ingresos(integer, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_tipo(
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
    SELECT d.tipo_arreglo_id AS tipo_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)

    UNION ALL

    SELECT ol.tipo_arreglo_id AS tipo_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT
      COALESCE(t.nombre, 'Sin tipo')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.tipos_arreglo t ON t.id = l.tipo_id
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
    SELECT 'Otros'::text AS label,
           COALESCE(SUM(cantidad), 0)::int AS cantidad,
           COALESCE(SUM(monto), 0)::numeric AS monto
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
    SELECT d.empleado_id AS empleado_id, (d.cantidad * d.valor)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)

    UNION ALL

    SELECT ol.empleado_id AS empleado_id, (ol.cantidad * ol.monto_unitario)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT
      COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label,
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
    SELECT 'Otros'::text AS label,
           COALESCE(SUM(cantidad), 0)::int AS cantidad,
           COALESCE(SUM(monto), 0)::numeric AS monto
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

CREATE OR REPLACE FUNCTION public.dashboard_costo_por_tipo(
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
    SELECT ol.tipo_arreglo_id AS tipo_id,
           (ol.cantidad * p.costo_unitario)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
  ),
  agg AS (
    SELECT
      COALESCE(t.nombre, 'Sin tipo')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.costo), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.tipos_arreglo t ON t.id = l.tipo_id
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
    SELECT 'Otros'::text AS label,
           COALESCE(SUM(cantidad), 0)::int AS cantidad,
           COALESCE(SUM(monto), 0)::numeric AS monto
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

-- Costo por empleado = costo de repuestos atribuidos + sueldo vigente en el
-- periodo (el sueldo es mensual; se calcula por mes y se suma al costo de
-- repuestos del empleado en todo el rango, igual que dashboard_gastos_por_periodo
-- calcula sueldos solo a granularidad mensual). A diferencia de sus 3 funciones
-- hermanas, p_from/p_to son obligatorios aqui (no toleran NULL): la generacion
-- de la serie mensual de sueldos no puede operar sobre un rango indefinido.
-- El dashboard siempre invoca esta funcion con un periodo concreto.
CREATE OR REPLACE FUNCTION public.dashboard_costo_por_empleado(
  p_from      timestamptz,
  p_to        timestamptz,
  top         integer     DEFAULT 6,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(label text, cantidad integer, monto numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'p_from y p_to son obligatorios';
  END IF;

  RETURN QUERY
  WITH repuestos AS (
    SELECT ol.empleado_id AS empleado_id,
           COUNT(*)::int AS cantidad,
           COALESCE(SUM(ol.cantidad * p.costo_unitario), 0)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', p_from),
      date_trunc('month', p_to - interval '1 second'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldos AS (
    SELECT e.id AS empleado_id,
           COALESCE(SUM(eff.salario), 0)::numeric AS sueldo
    FROM public.empleados e
    JOIN meses m ON true
    LEFT JOIN LATERAL (
      SELECT es.salario
      FROM public.empleado_salarios es
      WHERE es.empleado_id = e.id
        AND es.vigente_desde < (m.mes_start + interval '1 month')::date
      ORDER BY es.vigente_desde DESC
      LIMIT 1
    ) eff ON true
    WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id)
      AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
    GROUP BY 1
    HAVING COALESCE(SUM(eff.salario), 0) > 0
  ),
  -- FULL OUTER JOIN de dos CTEs ya agregadas por empleado_id (no un self-join
  -- via una lista intermedia de ids): sueldos.empleado_id nunca es NULL (sale
  -- de una fila real de empleados), asi que un `=` comun basta -- para la fila
  -- "Sin asignar" de repuestos (empleado_id NULL) nunca matchea contra
  -- sueldos, y el FULL OUTER JOIN la preserva igual con su.* en NULL.
  agg AS (
    SELECT
      COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label,
      COALESCE(r.cantidad, 0) AS cantidad,
      (COALESCE(r.costo, 0) + COALESCE(su.sueldo, 0))::numeric AS monto
    FROM repuestos r
    FULL OUTER JOIN sueldos su ON su.empleado_id = r.empleado_id
    LEFT JOIN public.empleados e ON e.id = COALESCE(r.empleado_id, su.empleado_id)
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT ranked.label, ranked.cantidad, ranked.monto
    FROM ranked WHERE ranked.rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label,
           COALESCE(SUM(ranked.cantidad), 0)::int AS cantidad,
           COALESCE(SUM(ranked.monto), 0)::numeric AS monto
    FROM ranked WHERE ranked.rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT top_rows.label, top_rows.cantidad, top_rows.monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT otros.label, otros.cantidad, otros.monto, 1 AS sort_group FROM otros WHERE otros.monto > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_tipo(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_facturacion_por_empleado(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_tipo(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_costo_por_empleado(timestamptz, timestamptz, integer, uuid) TO authenticated, service_role;
