CREATE OR REPLACE FUNCTION public.delete_particular (
  particular_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- Eliminar de la tabla particulares
  DELETE FROM particulares WHERE id = particular_id;
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = particular_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."delete_particular"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."delete_particular"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_particular"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_particular"(uuid) TO "postgres";
