CREATE OR REPLACE FUNCTION public.rpc_listar_empleados_valor_hora (
  p_taller_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    empleado_id uuid,
    valor_hora  numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'sesión autenticada requerida';
  END IF;
  IF NOT public._b2c179_tiene_permiso('empleados:view') THEN
    RAISE EXCEPTION 'permiso empleados:view requerido';
  END IF;
  RETURN QUERY
  SELECT e.id, e.valor_hora
  FROM public.empleados e
  WHERE e.tenant_id = v_tenant_id
    AND (p_taller_id IS NULL OR e.taller_id = p_taller_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_empleados_valor_hora"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_empleados_valor_hora"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_listar_empleados_valor_hora"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_listar_empleados_valor_hora"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_empleados_valor_hora"(uuid) TO "postgres";
