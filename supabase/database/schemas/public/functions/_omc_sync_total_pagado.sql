CREATE FUNCTION public._omc_sync_total_pagado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_op_id uuid;
  v_tot numeric;
  v_tipo public.tipo_operacion;
  v_actual numeric;
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  v_op_id := COALESCE(NEW.operacion_id, OLD.operacion_id);

  SELECT tipo, total_pagado INTO v_tipo, v_actual
  FROM public.operaciones
  WHERE id = v_op_id;

  IF FOUND AND v_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion, 'AJUSTE_FINANCIERO'::public.tipo_operacion) THEN
    SELECT COALESCE(ABS(SUM(importe)), 0) INTO v_tot
    FROM public.operaciones_movimiento_cuenta
    WHERE operacion_id = v_op_id;

    IF v_actual IS DISTINCT FROM v_tot THEN
      UPDATE public.operaciones
      SET total_pagado = v_tot
      WHERE id = v_op_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.operacion_id IS DISTINCT FROM NEW.operacion_id THEN
    SELECT tipo, total_pagado INTO v_tipo, v_actual
    FROM public.operaciones
    WHERE id = OLD.operacion_id;

    IF FOUND AND v_tipo IN ('COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'GASTO'::public.tipo_operacion, 'AJUSTE_FINANCIERO'::public.tipo_operacion) THEN
      SELECT COALESCE(ABS(SUM(importe)), 0) INTO v_tot
      FROM public.operaciones_movimiento_cuenta
      WHERE operacion_id = OLD.operacion_id;

      IF v_actual IS DISTINCT FROM v_tot THEN
        UPDATE public.operaciones
        SET total_pagado = v_tot
        WHERE id = OLD.operacion_id;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

GRANT ALL ON FUNCTION public._omc_sync_total_pagado() TO anon;

GRANT ALL ON FUNCTION public._omc_sync_total_pagado() TO authenticated;

GRANT ALL ON FUNCTION public._omc_sync_total_pagado() TO service_role;