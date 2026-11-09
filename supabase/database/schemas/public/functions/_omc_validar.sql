CREATE FUNCTION public._omc_validar()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_op record;
BEGIN
  SELECT o.tenant_id, o.tipo, o.fecha INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', NEW.operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_op.tenant_id THEN
    RAISE EXCEPTION 'Tenant de OMC (%) no coincide con la operación (%)', NEW.tenant_id, v_op.tenant_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(
    NEW.cuenta_id,
    NEW.tenant_id,
    (TG_OP = 'INSERT' OR NEW.cuenta_id IS DISTINCT FROM OLD.cuenta_id)
  );

  NEW.fecha := COALESCE(NEW.fecha, v_op.fecha, now());

  -- Rechazar OMC sobre ASIGNACION_ARREGLO y AJUSTE
  IF v_op.tipo IN ('ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Operaciones de tipo % no admiten movimientos de cuenta', v_op.tipo USING ERRCODE = '22023';
  END IF;

  -- Regla de signo según tipo
  IF v_op.tipo IN ('VENTA'::public.tipo_operacion, 'INGRESO'::public.tipo_operacion, 'COBRO_ARREGLO'::public.tipo_operacion) THEN
    IF NEW.importe <= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser positivo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN ('COMPRA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion) THEN
    IF NEW.importe >= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser negativo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN ('APERTURA_CUENTA'::public.tipo_operacion, 'TRANSFERENCIA'::public.tipo_operacion, 'AJUSTE_FINANCIERO'::public.tipo_operacion, 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion, 'MOVIMIENTO_CLIENTE'::public.tipo_operacion) THEN
    IF NEW.importe = 0 THEN
      RAISE EXCEPTION 'El importe de OMC no puede ser cero' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public._omc_validar() TO anon;

GRANT ALL ON FUNCTION public._omc_validar() TO authenticated;

GRANT ALL ON FUNCTION public._omc_validar() TO service_role;