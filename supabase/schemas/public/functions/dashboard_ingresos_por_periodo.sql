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
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  ia AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";
