CREATE FUNCTION public._omc_after_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_asiento_vigente record;
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- Busca el asiento vigente de OLD.id (que no haya sido revertido)
  SELECT mf.id, mf.importe, mf.cuenta_financiera_id
  INTO v_asiento_vigente
  FROM public.movimientos_financieros mf
  WHERE mf.omc_id = OLD.id
    AND mf.reversion_de_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros rev
      WHERE rev.reversion_de_id = mf.id
    )
  ORDER BY mf.created_at DESC, mf.id DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public._ledger_insertar(
      OLD.operacion_id,
      OLD.tenant_id,
      v_asiento_vigente.cuenta_financiera_id,
      -v_asiento_vigente.importe,
      now(),
      OLD.id,
      v_asiento_vigente.id
    );
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._omc_after_delete() FROM PUBLIC;