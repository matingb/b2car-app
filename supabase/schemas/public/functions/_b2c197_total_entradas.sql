-- Invoker rights: callers retain RLS; internal definer callers check tenant.
CREATE OR REPLACE FUNCTION public._b2c197_total_entradas(
  p_arreglo_id uuid, p_incluye boolean, p_tasa numeric, p_pendientes jsonb,
  p_formulario boolean DEFAULT true
) RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT coalesce(sum(public.importe_comercial_arreglo(x.importe, p_incluye, p_tasa)), 0)
  FROM (
    SELECT d.cantidad * coalesce(d.horas_facturadas, 1) * d.precio_hora_facturada AS importe
    FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT l.cantidad * l.monto_unitario
    FROM public.operaciones_asignacion_arreglo oa
    JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT (j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric
    FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) j
    UNION ALL
    SELECT c.costo FROM (
      SELECT costo FROM public.detalle_form_custom
      WHERE arreglo_id = p_arreglo_id AND p_formulario
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
  ) x;
$function$;
REVOKE ALL ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) TO authenticated, service_role;
