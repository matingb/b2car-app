CREATE FUNCTION public.dashboard_sum_ingresos (
  p_from timestamp with time zone,
  p_to   timestamp with time zone
)
  RETURNS numeric
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COALESCE(SUM(public.importe_comercial_arreglo(CASE WHEN d.horas_facturadas IS NULL
    THEN d.cantidad * d.precio_hora_facturada
    ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END, a.precios_incluyen_iva, a.tasa_iva)), 0)::numeric
  FROM public.arreglos a
  JOIN public.detalle_arreglo d ON d.arreglo_id = a.id
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$function$;

GRANT ALL ON FUNCTION public.dashboard_sum_ingresos(timestamp WITH time zone, timestamp WITH time zone) TO anon;

GRANT ALL ON FUNCTION public.dashboard_sum_ingresos(timestamp WITH time zone, timestamp WITH time zone) TO authenticated;

GRANT ALL ON FUNCTION public.dashboard_sum_ingresos(timestamp WITH time zone, timestamp WITH time zone) TO service_role;