CREATE OR REPLACE FUNCTION public._finanzas_exigir_cuenta (
  p_cuenta_id     uuid,
  p_tenant_id     uuid,
  p_exigir_activa boolean DEFAULT true
)
  RETURNS public.cuentas_financieras
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_cuenta public.cuentas_financieras;
BEGIN
  IF p_cuenta_id IS NULL THEN RAISE EXCEPTION 'cuenta_id es requerido' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_cuenta FROM public.cuentas_financieras AS c
  WHERE c.id = p_cuenta_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta financiera % no existe', p_cuenta_id USING ERRCODE = 'P0002'; END IF;
  IF p_exigir_activa AND NOT v_cuenta.activo THEN
    RAISE EXCEPTION 'La cuenta % está inactiva', v_cuenta.nombre USING ERRCODE = '22023';
  END IF;
  RETURN v_cuenta;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_exigir_cuenta"(uuid, uuid, boolean) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_exigir_cuenta"(uuid, uuid, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_exigir_cuenta"(uuid, uuid, boolean) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_exigir_cuenta"(uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_exigir_cuenta"(uuid, uuid, boolean) TO "postgres";
