CREATE OR REPLACE FUNCTION public.dashboard_costo_por_empleado (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  top         integer                  DEFAULT 6,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN RAISE EXCEPTION 'p_from y p_to son obligatorios'; END IF;
  RETURN QUERY
  WITH repuestos AS (
    SELECT ol.empleado_id AS empleado_id, COUNT(*)::int AS cantidad, COALESCE(SUM(ol.cantidad * p.costo_unitario), 0)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  meses AS (SELECT generate_series(date_trunc('month', p_from), date_trunc('month', p_to - interval '1 second'), interval '1 month') AS mes_start),
  sueldos AS (
    SELECT e.id AS empleado_id, COALESCE(SUM(eff.salario), 0)::numeric AS sueldo
    FROM public.empleados e
    JOIN meses m ON true
    LEFT JOIN LATERAL (SELECT es.salario FROM public.empleado_salarios es WHERE es.empleado_id = e.id AND es.vigente_desde < (m.mes_start + interval '1 month')::date ORDER BY es.vigente_desde DESC LIMIT 1) eff ON true
    WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id) AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
    GROUP BY 1 HAVING COALESCE(SUM(eff.salario), 0) > 0
  ),
  agg AS (
    SELECT COALESCE(NULLIF(trim(e.nombre || ' ' || e.apellido), ''), 'Sin asignar')::text AS label, COALESCE(r.cantidad, 0) AS cantidad, (COALESCE(r.costo, 0) + COALESCE(su.sueldo, 0))::numeric AS monto
    FROM repuestos r
    FULL OUTER JOIN sueldos su ON su.empleado_id = r.empleado_id
    LEFT JOIN public.empleados e ON e.id = COALESCE(r.empleado_id, su.empleado_id)
  ),
  ranked AS (SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg),
  top_rows AS (SELECT ranked.label, ranked.cantidad, ranked.monto FROM ranked WHERE ranked.rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(ranked.cantidad), 0)::int AS cantidad, COALESCE(SUM(ranked.monto), 0)::numeric AS monto FROM ranked WHERE ranked.rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto FROM (SELECT top_rows.label, top_rows.cantidad, top_rows.monto, 0 AS sort_group FROM top_rows UNION ALL SELECT otros.label, otros.cantidad, otros.monto, 1 AS sort_group FROM otros WHERE otros.monto > 0) s ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_empleado"(timestamp WITH time zone, timestamp WITH time zone, integer, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_empleado"(timestamp WITH time zone, timestamp WITH time zone, integer, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_costo_por_empleado"(timestamp WITH time zone, timestamp WITH time zone, integer, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_costo_por_empleado"(timestamp WITH time zone, timestamp WITH time zone, integer, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_empleado"(timestamp WITH time zone, timestamp WITH time zone, integer, uuid) TO "postgres";
