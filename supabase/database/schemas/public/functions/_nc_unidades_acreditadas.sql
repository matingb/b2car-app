CREATE FUNCTION public._nc_unidades_acreditadas (
  p_nota_id uuid
)
  RETURNS TABLE (
    operacion_linea_id uuid,
    cantidad           integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  WITH originales AS (
    SELECT COALESCE((j.linea->>'ordinal')::integer, l.ordinal) AS ordinal,
      CASE WHEN j.linea IS NULL THEN l.source_id ELSE (j.linea->>'sourceId')::uuid END AS source_id,
      COALESCE((j.linea->>'cantidad')::numeric, l.cantidad) AS cantidad,
      COALESCE((j.linea->>'importeTotal')::numeric, (j.linea->>'subtotal')::numeric, l.importe_total) AS importe
    FROM public.facturas_electronicas n
    JOIN public.facturas_electronicas_lineas l ON l.factura_id = n.documento_asociado_id
    LEFT JOIN LATERAL jsonb_array_elements(l.snapshot->'lineasOriginales') j(linea) ON true
    WHERE n.id = p_nota_id
  )
  SELECT o.source_id, SUM(FLOOR(ROUND(nl.importe_total * 100) * o.cantidad / NULLIF(ROUND(o.importe * 100), 0)))::integer
  FROM public.facturas_electronicas_lineas nl
  JOIN originales o ON o.ordinal = (nl.snapshot->>'ordinalOriginal')::integer
  WHERE nl.factura_id = p_nota_id AND o.source_id IS NOT NULL
  GROUP BY o.source_id;
$function$;

REVOKE ALL ON FUNCTION public._nc_unidades_acreditadas(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._nc_unidades_acreditadas(uuid) TO service_role;