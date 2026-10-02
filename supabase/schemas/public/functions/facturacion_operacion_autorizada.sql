CREATE OR REPLACE FUNCTION public.facturacion_operacion_autorizada (
  p_operacion_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT EXISTS (SELECT 1 FROM public.facturas_electronicas f
    WHERE f.operacion_id = p_operacion_id AND f.estado = 'AUTORIZADA');
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_operacion_autorizada"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_operacion_autorizada"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_operacion_autorizada"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_operacion_autorizada"(uuid) TO "postgres";
