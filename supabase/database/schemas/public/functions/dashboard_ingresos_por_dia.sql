CREATE FUNCTION public.dashboard_ingresos_por_dia (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    fecha        date,
    mano_de_obra numeric,
    repuestos    numeric,
    ventas       numeric
  )
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  WITH dias AS (
    SELECT generate_series(
      date_trunc('day', (p_from + interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      date_trunc('day', (p_to - interval '12 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires'),
      interval '1 day'
    ) AS dia
  ),
  ra AS (
    SELECT date_trunc('day', a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
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
    SELECT date_trunc('day', a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  vd AS (
    SELECT date_trunc('day', o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS ventas
    FROM public.operaciones o
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'VENTA' AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT d.dia::date,
         GREATEST(COALESCE(ia.total, 0) - COALESCE(ra.rep, 0), 0)::numeric,
         COALESCE(ra.rep, 0)::numeric,
         COALESCE(vd.ventas, 0)::numeric
  FROM dias d
  LEFT JOIN ra USING (dia)
  LEFT JOIN ia USING (dia)
  LEFT JOIN vd USING (dia)
  ORDER BY d.dia;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_ingresos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.dashboard_ingresos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_ingresos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;