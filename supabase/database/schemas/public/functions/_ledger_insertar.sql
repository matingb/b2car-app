CREATE FUNCTION public._ledger_insertar (
  p_operacion_id    uuid,
  p_tenant_id       uuid,
  p_cuenta_id       uuid,
  p_importe         numeric,
  p_fecha           timestamp with time zone,
  p_omc_id          uuid                     DEFAULT NULL::uuid,
  p_reversion_de_id uuid                     DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.movimientos_financieros (
    tenant_id, cuenta_financiera_id, importe, fecha, operacion_id, omc_id, reversion_de_id
  )
  VALUES (
    p_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()), p_operacion_id, p_omc_id, p_reversion_de_id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._ledger_insertar(uuid, uuid, uuid, numeric, timestamp WITH time zone, uuid, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._ledger_insertar(uuid, uuid, uuid, numeric, timestamp WITH time zone, uuid, uuid) TO service_role;