-- Series diarias del dashboard para comparar períodos arbitrarios.
--
-- Las funciones dashboard_*_por_periodo eligen el bucket según el largo del rango (día, semana o mes)
-- y devuelven un label ya formateado ('DD', 'DD/MM', 'MM/YY'). Eso no sirve para rangos que cruzan
-- meses ni para reagrupar en el cliente. Las funciones dashboard_*_por_dia devuelven siempre una fila
-- por día con su fecha calendario de Buenos Aires; la agrupación semanal o mensual queda en el frontend.
--
-- dashboard_periodo junta el resumen de cobro y las tres series en una sola llamada:
-- - Todas las funciones que intervienen son STABLE. PostgREST las ejecuta en una transacción de solo
--   lectura y, como se resuelven dentro de una única sentencia, comparten el snapshot de la consulta:
--   los totales y las series de un período no pueden quedar desfasados por una escritura concurrente.
-- - Solo leen (lock ACCESS SHARE): no bloquean ni quedan bloqueadas por otras consultas del dashboard
--   ni por las escrituras de la app.
-- - Devuelve un único jsonb, así que el límite max_rows de PostgREST no trunca rangos largos.
--
-- Las funciones dashboard_*_por_periodo y dashboard_pick_bucket dejan de usarse desde el frontend.
-- Se mantienen para que la versión desplegada siga funcionando hasta publicar la nueva; se pueden
-- borrar en una migración posterior.

ALTER FUNCTION public.dashboard_arreglos_resumen(timestamp with time zone, timestamp with time zone, uuid) STABLE;

CREATE OR REPLACE FUNCTION public.dashboard_arreglos_por_dia (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    fecha    date,
    cantidad bigint
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
  agg AS (
    SELECT date_trunc('day', a.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COUNT(*)::bigint AS cnt
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  )
  SELECT d.dia::date, COALESCE(agg.cnt, 0)::bigint
  FROM dias d LEFT JOIN agg USING (dia)
  ORDER BY d.dia;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_ingresos_por_dia (
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

-- Los sueldos son mensuales: se imputan al día 1 de cada mes. Un rango que arranca a mitad de mes no
-- incluye el sueldo de ese mes; uno que contiene el día 1 lo incluye completo.
CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_dia (
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
    SELECT date_trunc('day', o.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE omc.subtipo = 'GASTO'
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT d.dia::date,
         COALESCE(c.rep, 0)::numeric,
         COALESCE(sm.importe, 0)::numeric,
         COALESCE(ge.eventual, 0)::numeric
  FROM dias AS d
  LEFT JOIN compras AS c USING (dia)
  LEFT JOIN sueldo_mes AS sm USING (dia)
  LEFT JOIN gastos_eventuales AS ge USING (dia)
  ORDER BY d.dia;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'Rango de fechas inválido: p_from debe ser anterior a p_to'
      USING ERRCODE = '22023';
  END IF;

  -- Una sola sentencia: el resumen y las tres series se calculan sobre el mismo snapshot.
  RETURN (
    SELECT jsonb_build_object(
      'resumen', (
        SELECT to_jsonb(r)
        FROM public.dashboard_arreglos_resumen(p_from, p_to, p_taller_id) AS r
      ),
      'arreglos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_arreglos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb),
      'ingresos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_ingresos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb),
      'gastos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) ORDER BY d.fecha)
        FROM public.dashboard_gastos_por_dia(p_from, p_to, p_taller_id) AS d
      ), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_por_dia(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_por_dia(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_ingresos_por_dia(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_ingresos_por_dia(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_gastos_por_dia(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_dia(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dashboard_periodo(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_periodo(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;
