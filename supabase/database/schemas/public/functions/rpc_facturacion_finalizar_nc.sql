CREATE FUNCTION public.rpc_facturacion_finalizar_nc (
  p_tenant_id       uuid,
  p_nota_id         uuid,
  p_cae             text,
  p_cae_vencimiento date
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_linea_id uuid;
  v_source record;
  v_taller_id uuid;
  v_operacion uuid;
  v_item record;
  v_used bigint;
  v_cancelar integer;
  v_ajuste_linea_id uuid;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Finalización reservada al servicio de facturación';
  END IF;

  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN
    RAISE EXCEPTION 'Nota de crédito no encontrada';
  END IF;

  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones
      WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL
    ) THEN
      RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar';
    END IF;
    RETURN p_nota_id;
  END IF;

  IF v_nota.estado NOT IN ('ENVIANDO','INCIERTA') OR p_cae IS NULL OR p_cae !~ '^[0-9]{14}$' OR p_cae_vencimiento IS NULL THEN
    RAISE EXCEPTION 'Datos de autorización inválidos';
  END IF;

  SELECT * INTO v_original
  FROM public.facturas_electronicas
  WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND OR v_original.documento_tipo <> 'FACTURA' OR v_original.estado <> 'AUTORIZADA'
     OR v_original.origen_tipo NOT IN ('VENTA','ARREGLO')
     OR v_nota.origen_tipo IS DISTINCT FROM v_original.origen_tipo THEN
    RAISE EXCEPTION 'Factura original no autorizada o con origen inconsistente';
  END IF;

  IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id=p_nota_id AND operacion_ajuste_id IS NOT NULL) THEN
    RAISE EXCEPTION 'La nota tiene un ajuste de stock previo y requiere reconciliación';
  END IF;

  -- 1. Tratar cada línea acreditada: cancelar pendientes y validar devoluciones físicas
  FOR v_linea_id IN
    SELECT a.operacion_linea_id FROM public._nc_unidades_acreditadas(p_nota_id) a
    UNION SELECT d.operacion_linea_id FROM public.facturacion_nc_devoluciones d WHERE d.nota_credito_id = p_nota_id
    ORDER BY operacion_linea_id
  LOOP
    SELECT sfo.operacion_origen_id, sfo.stock_id, sfo.taller_id, sfo.producto_id,
           ol.cantidad, ol.cantidad_cumplida, ol.cantidad_cancelada
    INTO v_source
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    WHERE sfo.tenant_id = v_tenant AND sfo.factura_id = v_original.id AND sfo.operacion_linea_id = v_linea_id
    FOR UPDATE OF ol;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La devolución perdió una procedencia física verificable';
    END IF;

    -- Cancelar unidades acreditadas no entregadas
    v_cancelar := LEAST(
      GREATEST(0,
        COALESCE((SELECT a.cantidad FROM public._nc_unidades_acreditadas(p_nota_id) a WHERE a.operacion_linea_id = v_linea_id), 0)
        - (SELECT COALESCE(SUM(d.cantidad), 0) FROM public.facturacion_nc_devoluciones d WHERE d.nota_credito_id = p_nota_id AND d.operacion_linea_id = v_linea_id)),
      GREATEST(0, v_source.cantidad - v_source.cantidad_cumplida - v_source.cantidad_cancelada)
    );

    IF v_cancelar > 0 THEN
      UPDATE public.operaciones_lineas
      SET cantidad_cancelada = cantidad_cancelada + v_cancelar
      WHERE id = v_linea_id;
    END IF;

    -- Validar que la devolución física total no supere lo entregado neto
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA') AND d.cantidad > 0;

    IF v_used > v_source.cantidad_cumplida THEN
      RAISE EXCEPTION 'La devolución física excede las unidades entregadas de la línea' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- 2. Crear las operaciones AJUSTE DEVOLUCION_NC con sus líneas y OMS
  FOR v_taller_id IN
    SELECT DISTINCT sfo.taller_id
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.tenant_id = v_tenant
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY sfo.taller_id
  LOOP
    INSERT INTO public.operaciones(tenant_id, tipo, taller_id, fecha, monto_total)
    VALUES (v_tenant, 'AJUSTE', v_taller_id, now(), 0)
    RETURNING id INTO v_operacion;

    INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo, descripcion)
    VALUES (v_operacion, v_tenant, 'DEVOLUCION_NC', 'Devolución de stock por Nota de Crédito #' || COALESCE(v_nota.numero_comprobante::text, p_nota_id::text));

    FOR v_item IN
      SELECT d.stock_id, sum(d.cantidad)::integer AS cantidad
      FROM public.facturacion_nc_devoluciones d
      JOIN public.facturacion_factura_stock_origenes sfo
        ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
        AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant
      WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
      GROUP BY d.stock_id ORDER BY d.stock_id
    LOOP
      INSERT INTO public.operaciones_lineas(operacion_id, stock_id, cantidad, monto_unitario, sentido)
      VALUES (v_operacion, v_item.stock_id, v_item.cantidad, 0, 1)
      RETURNING id INTO v_ajuste_linea_id;

      INSERT INTO public.operaciones_movimiento_stock (
        tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo
      ) VALUES (
        v_tenant, v_operacion, v_ajuste_linea_id, v_item.stock_id,
        v_item.cantidad, now(), 'Devolución por Nota de Crédito'
      );
    END LOOP;

    -- Vincular operacion_ajuste_id DESPUÉS de haber creado líneas y OMS
    UPDATE public.facturacion_nc_devoluciones d
    SET operacion_ajuste_id = v_operacion
    FROM public.facturacion_factura_stock_origenes sfo
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0 AND d.operacion_ajuste_id IS NULL
      AND sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant;
  END LOOP;

  UPDATE public.facturas_electronicas
  SET estado = 'AUTORIZADA', cae = p_cae, cae_vencimiento = p_cae_vencimiento,
      autorizada_at = now(), error_codigo = NULL, error_mensaje = NULL
  WHERE id = p_nota_id AND tenant_id = v_tenant;

  RETURN p_nota_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid, uuid, text, date) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid, uuid, text, date) TO service_role;