CREATE FUNCTION public._oms_after_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_orig record;
  v_stock record;
BEGIN
  IF current_setting('app.stock_tenant_cleanup', true) = 'on'
     OR current_setting('app.stock_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT *
  INTO v_orig
  FROM public.movimientos_stock m
  WHERE m.oms_id = OLD.id
    AND m.reversion_de_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos_stock rev
      WHERE rev.reversion_de_id = m.id
    )
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.movimientos_stock (
      tenant_id,
      taller_id,
      producto_id,
      stock_id,
      operacion_id,
      oms_id,
      tipo_movimiento,
      cantidad,
      saldo_anterior,
      saldo_posterior,
      fecha,
      motivo,
      created_by,
      reversion_de_id
    ) VALUES (
      v_orig.tenant_id,
      v_orig.taller_id,
      v_orig.producto_id,
      v_orig.stock_id,
      v_orig.operacion_id,
      OLD.id,
      'REVERSION',
      -v_orig.cantidad,
      0,
      0,
      now(),
      COALESCE(OLD.motivo, 'Reversión de impacto de stock'),
      OLD.created_by,
      v_orig.id
    );
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.movimientos_stock m WHERE m.oms_id = OLD.id
  ) THEN
    -- OMS migrado previo al Kardex: su impacto ya está reflejado en stocks.cantidad
    SELECT s.taller_id, s.producto_id
    INTO v_stock
    FROM public.stocks s
    WHERE s.id = OLD.stock_id;

    IF FOUND THEN
      INSERT INTO public.movimientos_stock (
        tenant_id,
        taller_id,
        producto_id,
        stock_id,
        operacion_id,
        oms_id,
        tipo_movimiento,
        cantidad,
        saldo_anterior,
        saldo_posterior,
        fecha,
        motivo,
        created_by,
        reversion_de_id
      ) VALUES (
        OLD.tenant_id,
        v_stock.taller_id,
        v_stock.producto_id,
        OLD.stock_id,
        OLD.operacion_id,
        OLD.id,
        'REVERSION',
        -OLD.cantidad,
        0,
        0,
        now(),
        COALESCE(OLD.motivo, 'Reversión de impacto de stock'),
        OLD.created_by,
        NULL
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE id = OLD.operacion_linea_id) THEN
    UPDATE public.operaciones_lineas
    SET cantidad_cumplida = (
      SELECT COALESCE(SUM(l.sentido * oms.cantidad), 0)
      FROM public.operaciones_movimiento_stock oms
      JOIN public.operaciones_lineas l ON l.id = oms.operacion_linea_id
      WHERE oms.operacion_linea_id = OLD.operacion_linea_id
    )
    WHERE id = OLD.operacion_linea_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.operaciones WHERE id = OLD.operacion_id) THEN
    PERFORM public._sync_operacion_estado_stock(OLD.operacion_id);
  END IF;

  IF EXISTS (SELECT 1 FROM public.stocks WHERE id = OLD.stock_id) THEN
    PERFORM public._sync_stock_derivados(OLD.stock_id);
  END IF;

  RETURN OLD;
END;
$function$;

GRANT ALL ON FUNCTION public._oms_after_delete() TO anon;

GRANT ALL ON FUNCTION public._oms_after_delete() TO authenticated;

GRANT ALL ON FUNCTION public._oms_after_delete() TO service_role;