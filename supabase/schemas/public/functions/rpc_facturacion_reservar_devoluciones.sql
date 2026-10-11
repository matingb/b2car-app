CREATE OR REPLACE FUNCTION public.rpc_facturacion_reservar_devoluciones(p_nota_id uuid, p_devoluciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_linea_id uuid;
  v_raw_id text;
  v_raw_cantidad text;
  v_cantidad_bigint bigint;
  v_cantidad integer;
  v_cantidad_original integer;
  v_stock uuid;
  v_taller uuid;
  v_origen_linea text;
  v_operacion_origen uuid;
  v_tipo_operacion text;
  v_used bigint;
  v_duplicate integer;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sesion sin tenant activo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.cliente_id = auth.uid() AND tm.tenant_id = v_tenant AND tm.rol = 'admin'
  ) THEN RAISE EXCEPTION 'Solo un administrador del tenant puede reservar devoluciones'; END IF;
  IF jsonb_typeof(COALESCE(p_devoluciones, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Devoluciones inválidas';
  END IF;

  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' OR v_nota.estado <> 'ENVIANDO' THEN
    RAISE EXCEPTION 'Nota de crédito inválida para reservar devoluciones';
  END IF;

  SELECT * INTO v_original
  FROM public.facturas_electronicas
  WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_original.documento_tipo <> 'FACTURA' OR v_original.estado <> 'AUTORIZADA'
     OR v_original.origen_tipo NOT IN ('VENTA','ARREGLO')
     OR v_nota.origen_tipo IS DISTINCT FROM v_original.origen_tipo THEN
    RAISE EXCEPTION 'La factura original no es una factura autorizada de venta o arreglo';
  END IF;

  SELECT count(*) INTO v_duplicate
  FROM (
    SELECT value->>'operacionLineaId'
    FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb))
    GROUP BY 1 HAVING count(*) > 1
  ) duplicated;
  IF v_duplicate > 0 THEN RAISE EXCEPTION 'No se puede repetir una línea de stock'; END IF;

  -- Validate all IDs/quantities before acquiring source locks.
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_raw_id := COALESCE(v_item->>'operacionLineaId', '');
    IF v_raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'El identificador de línea de stock es inválido';
    END IF;
    v_raw_cantidad := v_item->>'cantidad';
    IF v_raw_cantidad IS NULL OR v_raw_cantidad !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'La cantidad debe ser un entero no negativo';
    END IF;
    v_cantidad_bigint := v_raw_cantidad::bigint;
    IF v_cantidad_bigint > 2147483647 THEN RAISE EXCEPTION 'La cantidad supera el máximo permitido'; END IF;
  END LOOP;

  -- Lock physical source lines in a deterministic order across concurrent notes/invoices.
  FOR v_linea_id IN
    SELECT DISTINCT (entry.value->>'operacionLineaId')::uuid
    FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) AS entry(value)
    ORDER BY 1
  LOOP
    PERFORM 1
    FROM public.operaciones_lineas ol
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.operacion_linea_id = ol.id AND sfo.factura_id = v_original.id AND sfo.tenant_id = v_tenant
    JOIN public.stocks s ON s.id = sfo.stock_id AND s.tenant_id = v_tenant
    WHERE ol.id = v_linea_id
    FOR UPDATE OF ol, s;
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la procedencia física de la factura original'; END IF;
  END LOOP;

  -- On a rejected retry, replace only the unapplied reservation set atomically.
  DELETE FROM public.facturacion_nc_devoluciones
  WHERE nota_credito_id = p_nota_id AND operacion_ajuste_id IS NULL;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_linea_id := (v_item->>'operacionLineaId')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    SELECT sfo.cantidad_original, sfo.stock_id, sfo.taller_id, sfo.origen_linea, sfo.operacion_origen_id, o.tipo::text
      INTO v_cantidad_original, v_stock, v_taller, v_origen_linea, v_operacion_origen, v_tipo_operacion
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    JOIN public.operaciones o
      ON o.id = sfo.operacion_origen_id AND o.tenant_id = v_tenant
    JOIN public.stocks s
      ON s.id = sfo.stock_id AND s.tenant_id = v_tenant AND s.taller_id = sfo.taller_id
      AND s.taller_id = o.taller_id AND s.producto_id = sfo.producto_id
    WHERE sfo.factura_id = v_original.id AND sfo.tenant_id = v_tenant AND sfo.operacion_linea_id = v_linea_id
      AND ((v_original.origen_tipo = 'VENTA' AND sfo.origen_linea = 'VENTA'
            AND sfo.operacion_origen_id = v_original.operacion_id AND o.tipo = 'VENTA')
        OR (v_original.origen_tipo = 'ARREGLO' AND sfo.origen_linea = 'REPUESTO'
            AND o.tipo = 'ASIGNACION_ARREGLO'
            AND EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo oa
              WHERE oa.operacion_id = sfo.operacion_origen_id AND oa.arreglo_id = v_original.arreglo_id)));
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la venta o asignación original'; END IF;

    -- Zero explicitly means fiscal-only for this line, but membership is still validated.
    IF v_cantidad = 0 THEN CONTINUE; END IF;
    IF v_original.stock_origenes_hash IS NULL THEN
      RAISE EXCEPTION 'La factura histórica no tiene procedencia física verificable para devolver stock';
    END IF;
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id
      AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA')
      AND n.id <> p_nota_id;
    IF v_cantidad > v_cantidad_original - v_used THEN
      RAISE EXCEPTION 'La cantidad a devolver supera el saldo físico disponible';
    END IF;
    INSERT INTO public.facturacion_nc_devoluciones(
      tenant_id, nota_credito_id, factura_original_id, operacion_linea_id, stock_id, cantidad
    ) VALUES (v_tenant, p_nota_id, v_original.id, v_linea_id, v_stock, v_cantidad);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) TO authenticated, service_role;
