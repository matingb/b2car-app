-- v1.9.1 - Métricas de negocio del dashboard con filtro por período.
-- Las series se agrupan automáticamente según el rango:
-- 1 mes: día, 2-3 meses: semana, 4+ meses: mes.
--
-- Características:
-- * RPC consolidada `dashboard_arreglos_resumen` que devuelve total, cobrados,
--   pendientes y monto facturado en una sola fila (reemplaza 4 RPCs anteriores).
-- * Las series temporales (arreglos / ingresos / gastos por período) usan un
--   único bloque parametrizado por bucket, calculado en `dashboard_pick_bucket`.
-- * Todas las funciones aceptan `p_taller_id` opcional para filtrar por taller;
--   los sueldos solo se computan en granularidad mensual.
-- * Normaliza el trigger inicial de salarios al primer día del mes, alineado
--   con cómo el dashboard agrega los sueldos.

-- Reemplaza firmas anteriores para evitar overloads con defaults.
DROP FUNCTION IF EXISTS public.dashboard_count_arreglos();
DROP FUNCTION IF EXISTS public.dashboard_count_arreglos(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_count_arreglos_by_pago(boolean);
DROP FUNCTION IF EXISTS public.dashboard_count_arreglos_by_pago(boolean, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_sum_ingresos(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_tipos_con_ingresos(integer);
DROP FUNCTION IF EXISTS public.dashboard_tipos_con_ingresos(integer, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_arreglos_por_dia(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_arreglos_por_periodo(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_ingresos_por_mes(int);
DROP FUNCTION IF EXISTS public.dashboard_ingresos_por_mes(int, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_ingresos_por_periodo(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_gastos_por_mes(int);
DROP FUNCTION IF EXISTS public.dashboard_gastos_por_mes(int, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.dashboard_sum_gastos(timestamptz, timestamptz);

-- Índice de soporte: todas las RPCs filtran por fecha y, opcionalmente, por taller.
CREATE INDEX IF NOT EXISTS arreglos_taller_fecha_idx
  ON public.arreglos USING btree (taller_id, fecha);

-- 1. Resumen consolidado: total, cobrados, pendientes y monto facturado en una sola query.
CREATE OR REPLACE FUNCTION public.dashboard_arreglos_resumen(
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(total integer, cobrados integer, pendientes integer, monto_ingresos numeric)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int                                          AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int        AS cobrados,
    COUNT(*) FILTER (WHERE a.esta_pago = false)::int       AS pendientes,
    COALESCE(SUM(a.precio_final), 0)::numeric              AS monto_ingresos
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to   IS NULL OR a.fecha <  p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id);
$$;

-- 2. Top N tipos de arreglos con cantidad e ingresos, filtrado por período.
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
      COALESCE(NULLIF(TRIM(a.tipo), ''), 'Sin tipo')::text AS tipo,
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

-- 3. Helper: resuelve la granularidad temporal (bucket) según el rango.
CREATE OR REPLACE FUNCTION public.dashboard_pick_bucket(
  p_from timestamptz,
  p_to   timestamptz,
  OUT trunc_name text,
  OUT label_fmt  text,
  OUT step       interval
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_months int;
BEGIN
  v_months := (EXTRACT(YEAR FROM p_to)::int  - EXTRACT(YEAR FROM p_from)::int) * 12
            + (EXTRACT(MONTH FROM p_to)::int - EXTRACT(MONTH FROM p_from)::int);

  IF v_months <= 1 THEN
    trunc_name := 'day';   label_fmt := 'DD';    step := interval '1 day';
  ELSIF v_months <= 3 THEN
    trunc_name := 'week';  label_fmt := 'DD/MM'; step := interval '1 week';
  ELSE
    trunc_name := 'month'; label_fmt := 'MM/YY'; step := interval '1 month';
  END IF;
END;
$$;

-- 4. Arreglos por período (un solo bloque parametrizado por bucket).
CREATE OR REPLACE FUNCTION public.dashboard_arreglos_por_periodo(
  p_from      timestamptz,
  p_to        timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, cantidad bigint)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  agg AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt), COALESCE(agg.cnt, 0)
  FROM slots s LEFT JOIN agg USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

-- 5. Ingresos por período (mano de obra, repuestos, ventas).
CREATE OR REPLACE FUNCTION public.dashboard_ingresos_por_periodo(
  p_from      timestamptz,
  p_to        timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, mano_de_obra numeric, repuestos numeric, ventas numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  ra AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.arreglos a
    JOIN public.operaciones_asignacion_arreglo oa ON oa.arreglo_id = a.id
    JOIN public.operaciones o  ON o.id = oa.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  ),
  ia AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
    GROUP BY 1
  ),
  vd AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS ventas
    FROM public.operaciones o
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'VENTA' AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         GREATEST(COALESCE(ia.total, 0) - COALESCE(ra.rep, 0), 0),
         COALESCE(ra.rep, 0),
         COALESCE(vd.ventas, 0)
  FROM slots s
  LEFT JOIN ra USING (slot_start)
  LEFT JOIN ia USING (slot_start)
  LEFT JOIN vd USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

-- 6. Gastos por período (repuestos + sueldos; sueldos solo en granularidad mensual).
CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_periodo(
  p_from      timestamptz,
  p_to        timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, repuestos numeric, sueldos numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones o
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA' AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', p_from),
      date_trunc('month', p_to - interval '1 second'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start,
           COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios es
        JOIN public.empleados e ON e.id = es.empleado_id
        WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) eff
    ) lat ON true
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         COALESCE(compras.rep, 0),
         COALESCE(sm.sueldos, 0)
  FROM slots s
  LEFT JOIN compras    USING (slot_start)
  LEFT JOIN sueldo_mes sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  ORDER BY s.slot_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_tipos_con_ingresos(integer, timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_pick_bucket(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_ingresos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- 7. Normaliza la vigencia del salario al primer día del mes.
-- Va junto con el dashboard porque el cómputo de sueldos asume registros
-- anclados al inicio del mes; tener fechas arbitrarias rompía el join.
CREATE OR REPLACE FUNCTION public.empleados_register_initial_salario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.salario IS NOT NULL THEN
    INSERT INTO public.empleado_salarios (empleado_id, tenant_id, taller_id, salario, vigente_desde)
    VALUES (
      NEW.id,
      NEW.tenant_id,
      NEW.taller_id,
      NEW.salario,
      date_trunc('month', COALESCE(NEW.fecha_ingreso, CURRENT_DATE))::date
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: alinea los registros existentes al día 1 del mes.
UPDATE public.empleado_salarios
SET vigente_desde = date_trunc('month', vigente_desde)::date
WHERE EXTRACT(DAY FROM vigente_desde) <> 1;
