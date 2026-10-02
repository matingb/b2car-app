CREATE OR REPLACE FUNCTION public.delete_empresa (
  empresa_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
BEGIN
  -- Eliminar de la tabla empresas
  DELETE FROM empresas WHERE id = empresa_id;
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = empresa_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."delete_empresa"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."delete_empresa"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_empresa"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_empresa"(uuid) TO "postgres";
