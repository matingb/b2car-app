CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion_con_stock (
  p_operacion_id    uuid,
  p_tipo            text,
  p_taller_id       uuid,
  p_lineas          jsonb,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cuenta_id uuid := p_cuenta_id;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_cuenta_id IS NULL AND p_tipo IN ('COMPRA', 'VENTA') THEN
    SELECT m.cuenta_financiera_id INTO v_cuenta_id FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id AND m.tenant_id = v_tenant_id LIMIT 1;
  END IF;
  PERFORM public.rpc_borrar_operacion_con_stock(p_operacion_id, NULL);
  RETURN public.rpc_crear_operacion_con_stock(p_tipo, p_taller_id, p_lineas, NULL, p_fecha, v_cuenta_id, p_idempotency_key);
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_operacion_con_stock"(uuid, text, uuid, jsonb, timestamp WITH time zone, uuid, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_operacion_con_stock"(uuid, text, uuid, jsonb, timestamp WITH time zone, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_actualizar_operacion_con_stock"(uuid, text, uuid, jsonb, timestamp WITH time zone, uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_actualizar_operacion_con_stock"(uuid, text, uuid, jsonb, timestamp WITH time zone, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_operacion_con_stock"(uuid, text, uuid, jsonb, timestamp WITH time zone, uuid, uuid) TO "postgres";
