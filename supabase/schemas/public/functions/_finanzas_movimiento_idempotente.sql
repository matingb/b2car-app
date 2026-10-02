CREATE OR REPLACE FUNCTION public._finanzas_movimiento_idempotente (
  p_tenant_id       uuid,
  p_idempotency_key uuid,
  p_tipo_esperado   text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_idempotency_key IS NULL THEN RETURN NULL; END IF;
  SELECT omc.operacion_id INTO v_id FROM public.operaciones_movimiento_cuenta AS omc
  WHERE omc.tenant_id = p_tenant_id AND omc.idempotency_key = p_idempotency_key FOR UPDATE;
  RETURN v_id;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_movimiento_idempotente"(uuid, uuid, text) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_movimiento_idempotente"(uuid, uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_movimiento_idempotente"(uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_movimiento_idempotente"(uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_movimiento_idempotente"(uuid, uuid, text) TO "postgres";
