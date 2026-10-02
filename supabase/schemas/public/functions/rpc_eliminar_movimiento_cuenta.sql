CREATE OR REPLACE FUNCTION public.rpc_eliminar_movimiento_cuenta (
  p_operacion_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_count int;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023';
  END IF;
  PERFORM 1
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id
    AND omc.tenant_id = v_tenant_id
  FOR UPDATE OF o, omc;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
  DELETE FROM public.operaciones
  WHERE id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND tipo = 'MOVIMIENTO_CUENTA';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );
  RETURN v_count > 0;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_eliminar_movimiento_cuenta"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_eliminar_movimiento_cuenta"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_eliminar_movimiento_cuenta"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_eliminar_movimiento_cuenta"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_eliminar_movimiento_cuenta"(uuid) TO "postgres";
