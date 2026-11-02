CREATE FUNCTION public.facturacion_arreglo_autorizado (
  p_arreglo_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.arreglo_id = p_arreglo_id AND f.estado = 'AUTORIZADA'
  );
$function$;

GRANT ALL ON FUNCTION public.facturacion_arreglo_autorizado(uuid) TO anon;

GRANT ALL ON FUNCTION public.facturacion_arreglo_autorizado(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.facturacion_arreglo_autorizado(uuid) TO service_role;