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
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'), b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
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
      date_trunc('month', p_from),
      date_trunc('month', p_to - interval '1 second'), interval '1 month'
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
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
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

GRANT EXECUTE ON FUNCTION "public"."dashboard_gastos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_gastos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_gastos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_gastos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_gastos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";
