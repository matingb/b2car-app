CREATE OR REPLACE FUNCTION public.rpc_facturacion_finalizar_nc(p_tenant_id uuid, p_nota_id uuid, p_cae text, p_cae_vencimiento date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_operacion uuid;
  v_taller uuid;
  v_item record;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Finalización reservada al servicio de facturación'; END IF;
  SELECT * INTO v_nota FROM public.facturas_electronicas WHERE id = p_nota_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN RAISE EXCEPTION 'Nota de crédito no encontrada'; END IF;
  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL) THEN
      RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar';
    END IF;
    RETURN p_nota_id;
  END IF;
  IF v_nota.estado NOT IN ('ENVIANDO','INCIERTA') OR p_cae IS NULL OR p_cae !~ '^[0-9]{14}$' OR p_cae_vencimiento IS NULL THEN RAISE EXCEPTION 'Datos de autorización inválidos'; END IF;
  SELECT * INTO v_original FROM public.facturas_electronicas WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura original no encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL) THEN
    IF v_original.origen_tipo <> 'VENTA' THEN RAISE EXCEPTION 'La factura original no es una venta'; END IF;
    SELECT s.taller_id INTO v_taller FROM public.facturacion_nc_devoluciones d JOIN public.stocks s ON s.id = d.stock_id
    WHERE d.nota_credito_id = p_nota_id LIMIT 1;
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d JOIN public.stocks s ON s.id = d.stock_id WHERE d.nota_credito_id = p_nota_id AND s.taller_id IS DISTINCT FROM v_taller) THEN
      RAISE EXCEPTION 'Las líneas de devolución pertenecen a talleres diferentes';
    END IF;
    INSERT INTO public.operaciones(tenant_id,tipo,taller_id,fecha) VALUES (v_tenant,'AJUSTE',v_taller,now()) RETURNING id INTO v_operacion;
    FOR v_item IN SELECT d.stock_id,sum(d.cantidad)::integer AS cantidad FROM public.facturacion_nc_devoluciones d WHERE d.nota_credito_id=p_nota_id AND d.cantidad>0 GROUP BY d.stock_id ORDER BY d.stock_id LOOP
      UPDATE public.stocks SET cantidad = cantidad + v_item.cantidad, updated_at=now() WHERE id=v_item.stock_id AND tenant_id=v_tenant;
      INSERT INTO public.operaciones_lineas(operacion_id,stock_id,cantidad,monto_unitario,delta_cantidad) VALUES (v_operacion,v_item.stock_id,v_item.cantidad,0,v_item.cantidad);
      UPDATE public.facturacion_nc_devoluciones SET operacion_ajuste_id=v_operacion WHERE nota_credito_id=p_nota_id AND stock_id=v_item.stock_id;
    END LOOP;
  END IF;
  UPDATE public.facturas_electronicas SET estado='AUTORIZADA',cae=p_cae,cae_vencimiento=p_cae_vencimiento,autorizada_at=now(),error_codigo=NULL,error_mensaje=NULL WHERE id=p_nota_id;
  RETURN p_nota_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) TO service_role;
