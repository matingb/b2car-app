CREATE OR REPLACE FUNCTION public._finanzas_bloquear_mutacion_ledger()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Los movimientos del ledger son inmutables.' USING ERRCODE = '55000';
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_bloquear_mutacion_ledger"() TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_bloquear_mutacion_ledger"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_bloquear_mutacion_ledger"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_bloquear_mutacion_ledger"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_bloquear_mutacion_ledger"() TO "postgres";
