CREATE OR REPLACE FUNCTION public.facturacion_set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_set_updated_at"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_set_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_set_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_set_updated_at"() TO "postgres";
