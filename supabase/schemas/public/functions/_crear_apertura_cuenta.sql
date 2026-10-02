CREATE OR REPLACE FUNCTION public._crear_apertura_cuenta (
  p_tenant_id uuid,
  p_cuenta_id uuid,
  p_saldo     numeric,
  p_fecha     timestamp with time zone
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE v_op_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (p_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now())) RETURNING id INTO v_op_id;
  INSERT INTO public.operaciones_movimiento_cuenta (operacion_id, tenant_id, subtipo, cuenta_id, importe, created_by)
  VALUES (v_op_id, p_tenant_id, 'APERTURA_CUENTA', p_cuenta_id, p_saldo, auth.uid());
  RETURN v_op_id;
END; $function$;

CREATE OR REPLACE FUNCTION public._crear_apertura_cuenta (
  p_tenant_id  uuid,
  p_cuenta_id  uuid,
  p_saldo      numeric,
  p_fecha      timestamp with time zone,
  p_created_by uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (p_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;
  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id,
    tenant_id,
    subtipo,
    cuenta_id,
    importe,
    created_by
  )
  VALUES (
    v_operacion_id,
    p_tenant_id,
    'APERTURA_CUENTA',
    p_cuenta_id,
    p_saldo,
    p_created_by
  );
  RETURN v_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_crear_apertura_cuenta"(uuid, uuid, numeric, timestamp WITH time zone, uuid) TO "postgres";
