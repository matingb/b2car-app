CREATE OR REPLACE FUNCTION public._ledger_insertar (
  p_operacion_id uuid,
  p_tenant_id    uuid,
  p_cuenta_id    uuid,
  p_importe      numeric,
  p_fecha        timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.movimientos_financieros (tenant_id, cuenta_financiera_id, importe, fecha, operacion_id)
  VALUES (p_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()), p_operacion_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_ledger_insertar"(uuid, uuid, uuid, numeric, timestamp WITH time zone) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_ledger_insertar"(uuid, uuid, uuid, numeric, timestamp WITH time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_ledger_insertar"(uuid, uuid, uuid, numeric, timestamp WITH time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_ledger_insertar"(uuid, uuid, uuid, numeric, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_ledger_insertar"(uuid, uuid, uuid, numeric, timestamp WITH time zone) TO "postgres";
