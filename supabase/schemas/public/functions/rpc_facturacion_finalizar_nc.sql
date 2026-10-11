CREATE OR REPLACE FUNCTION public.rpc_facturacion_finalizar_nc(p_tenant_id uuid, p_nota_id uuid, p_cae text, p_cae_vencimiento date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_linea_id uuid;
  v_source record;
  v_taller_id uuid;
  v_operacion uuid;
  v_item record;
  v_rows integer;
  v_used bigint;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Finalización reservada al servicio de facturación';
  END IF;
  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN RAISE EXCEPTION 'Nota de crédito no encontrada'; END IF;
  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones
      WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL
    ) THEN RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar'; END IF;
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

  -- Serialize application by the physical source line, independent of invoice/environment.
  FOR v_linea_id IN
    SELECT DISTINCT d.operacion_linea_id
    FROM public.facturacion_nc_devoluciones d
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY d.operacion_linea_id
  LOOP
    SELECT sfo.operacion_origen_id, sfo.stock_id, sfo.taller_id, sfo.producto_id,
      sfo.origen_linea, sfo.cantidad_original, o.tipo::text AS tipo_operacion
    INTO v_source
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    JOIN public.operaciones o
      ON o.id = sfo.operacion_origen_id AND o.tenant_id = v_tenant
    JOIN public.stocks s
      ON s.id = sfo.stock_id AND s.tenant_id = v_tenant AND s.taller_id = sfo.taller_id
      AND s.taller_id = o.taller_id AND s.producto_id = sfo.producto_id
    WHERE sfo.tenant_id = v_tenant AND sfo.factura_id = v_original.id AND sfo.operacion_linea_id = v_linea_id
      AND ((v_original.origen_tipo = 'VENTA' AND sfo.origen_linea = 'VENTA'
            AND sfo.operacion_origen_id = v_original.operacion_id AND o.tipo = 'VENTA')
        OR (v_original.origen_tipo = 'ARREGLO' AND sfo.origen_linea = 'REPUESTO'
            AND o.tipo = 'ASIGNACION_ARREGLO'
            AND EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo oa
              WHERE oa.operacion_id = sfo.operacion_origen_id AND oa.arreglo_id = v_original.arreglo_id)))
    FOR UPDATE OF ol, s;
    IF NOT FOUND OR v_original.stock_origenes_hash IS NULL THEN
      RAISE EXCEPTION 'La devolución perdió una procedencia física verificable';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones d
      WHERE d.nota_credito_id = p_nota_id AND d.operacion_linea_id = v_linea_id AND d.stock_id = v_source.stock_id
    ) THEN RAISE EXCEPTION 'El stock reservado no coincide con la procedencia original'; END IF;
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA');
    IF v_used > v_source.cantidad_original THEN RAISE EXCEPTION 'El saldo físico reservado excede la cantidad original'; END IF;
  END LOOP;

  FOR v_taller_id IN
    SELECT DISTINCT sfo.taller_id
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.tenant_id = v_tenant
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY sfo.taller_id
  LOOP
    INSERT INTO public.operaciones(tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant, 'AJUSTE', v_taller_id, now())
    RETURNING id INTO v_operacion;

    FOR v_item IN
      SELECT d.stock_id, sum(d.cantidad)::integer AS cantidad
      FROM public.facturacion_nc_devoluciones d
      JOIN public.facturacion_factura_stock_origenes sfo
        ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
        AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant
      WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
      GROUP BY d.stock_id ORDER BY d.stock_id
    LOOP
      UPDATE public.stocks
      SET cantidad = cantidad + v_item.cantidad, updated_at = now()
      WHERE id = v_item.stock_id AND tenant_id = v_tenant AND taller_id = v_taller_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN RAISE EXCEPTION 'No se pudo reingresar el stock físico de origen'; END IF;

      INSERT INTO public.operaciones_lineas(operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad)
      VALUES (v_operacion, v_item.stock_id, v_item.cantidad, 0, v_item.cantidad);

      UPDATE public.facturacion_nc_devoluciones
      SET operacion_ajuste_id = v_operacion
      WHERE nota_credito_id = p_nota_id AND stock_id = v_item.stock_id AND operacion_ajuste_id IS NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows < 1 THEN RAISE EXCEPTION 'No se pudo registrar la trazabilidad del ajuste de stock'; END IF;
    END LOOP;
  END LOOP;

  UPDATE public.facturas_electronicas
  SET estado = 'AUTORIZADA', cae = p_cae, cae_vencimiento = p_cae_vencimiento,
      autorizada_at = now(), error_codigo = NULL, error_mensaje = NULL
  WHERE id = p_nota_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'No se pudo confirmar la autorización de la nota'; END IF;
  RETURN p_nota_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) TO service_role;
