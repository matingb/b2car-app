CREATE OR REPLACE FUNCTION public.rpc_actualizar_movimiento_cuenta (
  p_operacion_id      uuid,
  p_importe           numeric                  DEFAULT NULL::numeric,
  p_descripcion       text                     DEFAULT NULL::text,
  p_categoria_gasto   text                     DEFAULT NULL::text,
  p_cuenta_id         uuid                     DEFAULT NULL::uuid,
  p_cuenta_origen_id  uuid                     DEFAULT NULL::uuid,
  p_cuenta_destino_id uuid                     DEFAULT NULL::uuid,
  p_fecha             timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_idempotency_key   uuid                     DEFAULT NULL::uuid,
  p_arreglo_id        uuid                     DEFAULT NULL::uuid,
  p_observaciones     text                     DEFAULT NULL::text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_omc       public.operaciones_movimiento_cuenta%ROWTYPE;
  v_existente uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL AND v_existente <> p_operacion_id THEN RETURN v_existente; END IF;
  END IF;
  SELECT omc.* INTO v_omc FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id AND omc.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado: %', p_operacion_id USING ERRCODE = 'P0002'; END IF;
  IF p_fecha IS NOT NULL OR p_observaciones IS NOT NULL THEN
    UPDATE public.operaciones
    SET fecha = COALESCE(p_fecha, fecha),
        observaciones = CASE WHEN p_observaciones IS NOT NULL THEN NULLIF(btrim(p_observaciones), '') ELSE observaciones END
    WHERE id = p_operacion_id;
  END IF;
  UPDATE public.operaciones_movimiento_cuenta SET
    importe           = CASE WHEN p_importe IS NOT NULL THEN
                         CASE WHEN v_omc.subtipo = 'GASTO' THEN -abs(p_importe) ELSE abs(p_importe) END
                       ELSE importe END,
    cuenta_id         = COALESCE(p_cuenta_id, cuenta_id),
    cuenta_origen_id  = COALESCE(p_cuenta_origen_id, cuenta_origen_id),
    cuenta_destino_id = COALESCE(p_cuenta_destino_id, cuenta_destino_id),
    categoria_gasto   = CASE WHEN v_omc.subtipo = 'GASTO' THEN COALESCE(p_categoria_gasto, categoria_gasto) ELSE NULL END,
    descripcion       = COALESCE(nullif(btrim(p_descripcion), ''), descripcion),
    idempotency_key   = COALESCE(p_idempotency_key, idempotency_key)
  WHERE operacion_id = p_operacion_id;
  RETURN p_operacion_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_movimiento_cuenta"(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, uuid, text) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_movimiento_cuenta"(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, uuid, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_actualizar_movimiento_cuenta"(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_actualizar_movimiento_cuenta"(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_actualizar_movimiento_cuenta"(uuid, numeric, text, text, uuid, uuid, uuid, timestamp WITH time zone, uuid, uuid, text) TO "postgres";