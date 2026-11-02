CREATE FUNCTION public.dashboard_horas_facturadas_por_empleado (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'Rango de fechas invalido'
      USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH lineas AS (
      SELECT
        CASE WHEN e.id IS NULL THEN NULL::uuid ELSE d.empleado_id END AS empleado_id,
        COALESCE(
          NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' ', e.nombre, e.apellido)), ''),
          'Sin empleado'
        )::text AS label,
        d.horas_facturadas * d.cantidad AS horas_facturadas
      FROM public.detalle_arreglo AS d
      JOIN public.arreglos AS a
        ON a.id = d.arreglo_id
       AND a.tenant_id = d.tenant_id
      LEFT JOIN public.empleados AS e
        ON e.id = d.empleado_id
       AND e.tenant_id = d.tenant_id
      WHERE d.tenant_id = (SELECT public.current_tenant_id())
        AND a.tenant_id = (SELECT public.current_tenant_id())
        AND a.fecha >= p_from
        AND a.fecha < p_to
        AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
        AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
        AND d.horas_facturadas IS NOT NULL
    ),
    empleados AS (
      SELECT
        l.empleado_id,
        l.label,
        pg_catalog.sum(l.horas_facturadas)::numeric AS horas_facturadas
      FROM lineas AS l
      GROUP BY l.empleado_id, l.label
      HAVING pg_catalog.sum(l.horas_facturadas) > 0
    )
    SELECT pg_catalog.jsonb_build_object(
      'total_horas_facturadas', COALESCE(pg_catalog.sum(e.horas_facturadas), 0::numeric),
      'empleados', COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'empleado_id', e.empleado_id,
            'label', e.label,
            'horas_facturadas', e.horas_facturadas
          )
          ORDER BY e.horas_facturadas DESC, e.label ASC, e.empleado_id ASC
        ),
        '[]'::jsonb
      )
    )
    FROM empleados AS e
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_horas_facturadas_por_empleado(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.dashboard_horas_facturadas_por_empleado(timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_horas_facturadas_por_empleado(timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;