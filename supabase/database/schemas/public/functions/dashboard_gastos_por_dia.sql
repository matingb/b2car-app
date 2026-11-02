CREATE FUNCTION public.dashboard_gastos_por_dia (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    fecha      date,
    repuestos  numeric,
    sueldos    numeric,
    eventuales numeric
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
  compras AS (
    SELECT date_trunc('day', o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
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
    SELECT m.mes_start AS dia, COALESCE(lat.importe, 0)::numeric AS importe
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS importe
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
    SELECT date_trunc('day', omc.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE o.tipo = 'GASTO'::public.tipo_operacion
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND omc.fecha >= p_from AND omc.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT d.dia::date AS fecha,
         COALESCE(c.rep, 0)::numeric,
         COALESCE(sm.importe, 0)::numeric,
         COALESCE(ge.eventual, 0)::numeric
  FROM dias AS d
  LEFT JOIN compras AS c USING (dia)
  LEFT JOIN sueldo_mes AS sm USING (dia)
  LEFT JOIN gastos_eventuales AS ge USING (dia)
  ORDER BY d.dia;
$function$;

GRANT ALL ON FUNCTION public.dashboard_gastos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO anon;

GRANT ALL ON FUNCTION public.dashboard_gastos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_gastos_por_dia(timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;