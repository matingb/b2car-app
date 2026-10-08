CREATE OR REPLACE FUNCTION public.rpc_facturacion_reservar_devoluciones(p_nota_id uuid, p_devoluciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_linea_id uuid;
  v_cantidad integer;
  v_vendido integer;
  v_stock uuid;
  v_duplicate integer;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sesion sin tenant activo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.cliente_id = auth.uid() AND tm.tenant_id = v_tenant AND tm.rol = 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador del tenant puede reservar devoluciones';
  END IF;
  IF jsonb_typeof(COALESCE(p_devoluciones, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Devoluciones inválidas'; END IF;
  SELECT * INTO v_nota FROM public.facturas_electronicas WHERE id = p_nota_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' OR v_nota.estado <> 'ENVIANDO' THEN RAISE EXCEPTION 'Nota de crédito inválida para reservar devoluciones'; END IF;
  SELECT * INTO v_original FROM public.facturas_electronicas WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_original.origen_tipo <> 'VENTA' OR v_original.estado <> 'AUTORIZADA' THEN RAISE EXCEPTION 'La factura original no es una venta autorizada'; END IF;
  DELETE FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND operacion_ajuste_id IS NULL;
  SELECT count(*) INTO v_duplicate FROM (
    SELECT value->>'operacionLineaId' FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF v_duplicate > 0 THEN RAISE EXCEPTION 'No se puede repetir una línea de venta'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_linea_id := NULLIF(v_item->>'operacionLineaId','')::uuid;
    IF (v_item->>'cantidad') IS NULL OR (v_item->>'cantidad') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'La cantidad debe ser un entero no negativo'; END IF;
    v_cantidad := (v_item->>'cantidad')::integer;
    IF v_cantidad = 0 THEN CONTINUE; END IF;
    SELECT ol.stock_id, fel.cantidad::integer INTO v_stock, v_vendido
    FROM public.facturas_electronicas_lineas fel
    JOIN public.operaciones_lineas ol ON ol.id = fel.source_id
    JOIN public.operaciones o ON o.id = ol.operacion_id
    JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_tenant AND s.taller_id = o.taller_id
    WHERE fel.factura_id = v_original.id AND fel.origen = 'VENTA' AND fel.source_id = v_linea_id
      AND o.id = v_original.operacion_id AND o.tenant_id = v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la venta original'; END IF;
    IF v_cantidad > v_vendido - COALESCE((
      SELECT sum(d.cantidad) FROM public.facturacion_nc_devoluciones d
      JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
      WHERE d.factura_original_id = v_original.id AND d.operacion_linea_id = v_linea_id
        AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA') AND n.id <> p_nota_id
    ),0) THEN RAISE EXCEPTION 'La cantidad a devolver supera el saldo disponible'; END IF;
    INSERT INTO public.facturacion_nc_devoluciones(tenant_id, nota_credito_id, factura_original_id, operacion_linea_id, stock_id, cantidad)
    VALUES (v_tenant, p_nota_id, v_original.id, v_linea_id, v_stock, v_cantidad);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) TO authenticated, service_role;
