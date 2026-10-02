CREATE OR REPLACE FUNCTION public._finanzas_reversar_movimiento (
  p_movimiento_id   uuid,
  p_tenant_id       uuid,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_descripcion     text                     DEFAULT NULL::text,
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_mov record;
BEGIN
  SELECT m.tenant_id, m.cuenta_financiera_id, m.importe INTO v_mov
  FROM public.movimientos_financieros AS m
  WHERE m.id = p_movimiento_id AND m.tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento % no encontrado', p_movimiento_id USING ERRCODE = 'P0002'; END IF;
  RETURN public._ledger_insertar(NULL, v_mov.tenant_id, v_mov.cuenta_financiera_id, -v_mov.importe, COALESCE(p_fecha, now()));
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_reversar_movimiento"(uuid, uuid, timestamp WITH time zone, text, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_reversar_movimiento"(uuid, uuid, timestamp WITH time zone, text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_reversar_movimiento"(uuid, uuid, timestamp WITH time zone, text, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_reversar_movimiento"(uuid, uuid, timestamp WITH time zone, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_reversar_movimiento"(uuid, uuid, timestamp WITH time zone, text, uuid) TO "postgres";
