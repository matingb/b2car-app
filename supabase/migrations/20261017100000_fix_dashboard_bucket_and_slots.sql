-- Fix bucket picking and slot series generation for dashboard functions
-- Avoids selecting 'week' when month boundary crosses time zone / DST shifts (e.g. late Sept to Nov 1),
-- prevents extra boundary days when p_from/p_to have non-UTC offsets,
-- and converts event timestamps to 'America/Argentina/Buenos_Aires' so operations between 21:00 and 23:59 ARG
-- are attributed to the correct calendar day.

CREATE OR REPLACE FUNCTION public.dashboard_pick_bucket (
  p_from timestamp with time zone,
  p_to   timestamp with time zone,
  OUT    trunc_name text,
  OUT    label_fmt text,
  OUT    step interval
)
  RETURNS record
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_days numeric;
BEGIN
  v_days := EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0;
  IF v_days <= 35 THEN
    trunc_name := 'day';   label_fmt := 'DD';    step := interval '1 day';
  ELSIF v_days <= 100 THEN
    trunc_name := 'week';  label_fmt := 'DD/MM'; step := interval '1 week';
  ELSE
    trunc_name := 'month'; label_fmt := 'MM/YY'; step := interval '1 month';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_arreglos_por_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad bigint
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc(b.trunc_name, (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      b.step
    ) AS slot_start
  ),
  agg AS (
    SELECT date_trunc(b.trunc_name, a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt), COALESCE(agg.cnt, 0)
  FROM slots s LEFT JOIN agg USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_ingresos_por_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label        text,
    mano_de_obra numeric,
    repuestos    numeric,
    ventas       numeric
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc(b.trunc_name, (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      b.step
    ) AS slot_start
  ),
  ra AS (
    SELECT date_trunc(b.trunc_name, a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(public.importe_comercial_arreglo(ol.cantidad * ol.monto_unitario, a.precios_incluyen_iva, a.tasa_iva)), 0)::numeric AS rep
    FROM public.arreglos a
    JOIN public.operaciones_asignacion_arreglo oa ON oa.arreglo_id = a.id
    JOIN public.operaciones o  ON o.id = oa.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  ia AS (
    SELECT date_trunc(b.trunc_name, a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  vd AS (
    SELECT date_trunc(b.trunc_name, o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
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
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label      text,
    repuestos  numeric,
    sueldos    numeric,
    eventuales numeric
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc(b.trunc_name, (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('month', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start, COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE e.tenant_id = (SELECT public.current_tenant_id())
          AND (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc(b.trunc_name, o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS slot_start,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE omc.subtipo = 'GASTO'
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         COALESCE(c.rep, 0), COALESCE(sm.sueldos, 0), COALESCE(ge.eventual, 0)
  FROM slots AS s
  LEFT JOIN compras AS c USING (slot_start)
  LEFT JOIN sueldo_mes AS sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  LEFT JOIN gastos_eventuales AS ge USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_clientes_nuevos_por_dia (
  p_from timestamp with time zone,
  p_to   timestamp with time zone
)
  RETURNS TABLE (
    label text,
    valor integer
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('day', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 day'
    ) AS day
  ),
  agg AS (
    SELECT date_trunc('day', c.fecha_creacion AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day, COUNT(*)::int AS valor
    FROM public.clientes c
    WHERE c.fecha_creacion >= p_from
      AND c.fecha_creacion < p_to
    GROUP BY 1
  )
  SELECT
    to_char(days.day::date, 'DD/MM') AS label,
    COALESCE(agg.valor, 0)::int AS valor
  FROM days
  LEFT JOIN agg USING (day)
  ORDER BY days.day ASC;
$function$;
