CREATE FUNCTION public._b2c197_total_entradas (
  p_arreglo_id uuid,
  p_incluye    boolean,
  p_tasa       numeric,
  p_pendientes jsonb,
  p_formulario boolean DEFAULT true
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT coalesce(sum(public.importe_comercial_arreglo(x.total, p_incluye, p_tasa)), 0)
  FROM (
    SELECT coalesce(d.total, d.cantidad * coalesce(d.horas_facturadas, 1) * d.precio_hora_facturada - coalesce(d.descuento, 0)) AS total
    FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT coalesce(l.total, l.cantidad * l.monto_unitario - coalesce(l.descuento, 0))
    FROM public.operaciones_asignacion_arreglo oa
    JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT round((j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric, 2) - coalesce((j->>'descuento')::numeric, 0)
    FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) j
    UNION ALL
    SELECT coalesce(c.total, c.costo - coalesce(c.descuento, 0)) FROM (
      SELECT total, costo, descuento FROM public.detalle_form_custom
      WHERE arreglo_id = p_arreglo_id AND p_formulario
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
  ) x;
$function$;

REVOKE ALL ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) TO authenticated;

GRANT ALL ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) TO service_role;
