CREATE FUNCTION public.importe_comercial_arreglo (
  p_importe numeric,
  p_incluye boolean,
  p_tasa    numeric
)
  RETURNS numeric
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  SET search_path TO 'public'
  AS $function$
  SELECT CASE WHEN p_incluye THEN p_importe
    ELSE round(p_importe, 2) + round(round(p_importe, 2) * p_tasa, 2) END;
$function$;

GRANT ALL ON FUNCTION public.importe_comercial_arreglo(numeric, boolean, numeric) TO anon;

GRANT ALL ON FUNCTION public.importe_comercial_arreglo(numeric, boolean, numeric) TO authenticated;

GRANT ALL ON FUNCTION public.importe_comercial_arreglo(numeric, boolean, numeric) TO service_role;