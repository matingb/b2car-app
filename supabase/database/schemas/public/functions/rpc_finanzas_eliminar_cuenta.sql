CREATE FUNCTION public.rpc_finanzas_eliminar_cuenta (
  p_cuenta_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, false);

  UPDATE public.cuentas_financieras
  SET activo = false,
      favorita = false
  WHERE id = p_cuenta_id
    AND tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO service_role;