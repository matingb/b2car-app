-- psql -v ON_ERROR_STOP=1 -f ... sobre una base local migrada. Siempre revierte.
BEGIN;
DO $$
DECLARE t uuid; w uuid; p uuid; s uuid; op uuid; l uuid; f uuid; n uuid; u uuid;
  caso integer; entregadas integer; devueltas integer; saldo_previo integer; reserva_previa integer; monto numeric; canceladas integer; r record;
BEGIN
  SELECT id INTO u FROM auth.users LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'Ejecutar el seed local antes de este ensayo'; END IF;
  INSERT INTO public.tenants(nombre,plan_sub) VALUES('Ensayo NC','PRO') RETURNING id INTO t;
  INSERT INTO public.tenant_members(cliente_id,tenant_id,rol) VALUES(u,t,'admin')
  ON CONFLICT(cliente_id) DO UPDATE SET tenant_id=t,rol='admin';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('tenant_id',t,'role','service_role')::text,true);
  INSERT INTO public.talleres(tenant_id,nombre,ubicacion) VALUES(t,'Local','Local') RETURNING id INTO w;
  INSERT INTO public.productos(tenant_id,codigo,nombre) VALUES(t,'NC','Producto') RETURNING id INTO p;
  FOR caso IN 1..7 LOOP
    entregadas := CASE WHEN caso IN (1,3,5,6,7) THEN 2 ELSE 0 END;
    devueltas := CASE WHEN caso IN (1,5) THEN 2 ELSE 0 END;
    monto := CASE WHEN caso IN (5,6) THEN 200 WHEN caso=7 THEN 50 ELSE 500 END;
    canceladas := GREATEST(0,LEAST(FLOOR(monto/100)::integer-devueltas,5-entregadas));
    s := public.rpc_crear_stock(w,p,20);
    SELECT cantidad,cantidad_reservada INTO saldo_previo,reserva_previa FROM public.stocks WHERE id=s;
    op := public.rpc_crear_operacion_con_stock(p_tipo=>'VENTA',p_taller_id=>w,p_lineas=>
      jsonb_build_array(jsonb_build_object('stock_id',s,'cantidad',5,'cantidad_cumplida',entregadas,'monto_unitario',100)),p_estado_pago=>'PENDIENTE');
    SELECT id INTO l FROM public.operaciones_lineas WHERE operacion_id=op;
    INSERT INTO public.facturas_electronicas(tenant_id,operacion_id,origen_tipo,idempotency_key,emisor_snapshot,receptor_snapshot,concepto,fecha_comprobante,total,punto_venta,stock_origenes_hash)
    VALUES(t,op,'VENTA',gen_random_uuid(),'{}','{}',1,current_date,500,1,'ensayo') RETURNING id INTO f;
    INSERT INTO public.facturas_electronicas_lineas(factura_id,ordinal,origen,source_id,descripcion,cantidad,importe_unitario,subtotal,importe_total,snapshot)
    VALUES(f,1,'VENTA',CASE WHEN caso=4 THEN NULL ELSE l END,'Producto',5,100,500,500,
      CASE WHEN caso=4 THEN jsonb_build_object('lineasOriginales',jsonb_build_array(jsonb_build_object('ordinal',1,'sourceId',l,'cantidad',5,'importeTotal',500))) ELSE '{}'::jsonb END);
    INSERT INTO public.facturacion_factura_stock_origenes(tenant_id,factura_id,operacion_linea_id,operacion_origen_id,stock_id,taller_id,producto_id,origen_linea,cantidad_original,nombre_snapshot)
    VALUES(t,f,l,op,s,w,p,'VENTA',5,'Producto');
    UPDATE public.facturas_electronicas SET estado='AUTORIZADA' WHERE id=f;
    INSERT INTO public.facturas_electronicas(tenant_id,operacion_id,origen_tipo,idempotency_key,emisor_snapshot,receptor_snapshot,concepto,fecha_comprobante,total,punto_venta,tipo_comprobante,documento_tipo,documento_asociado_id)
    VALUES(t,op,'VENTA',gen_random_uuid(),'{}','{}',1,current_date,monto,1,13,'NOTA_CREDITO',f) RETURNING id INTO n;
    INSERT INTO public.facturas_electronicas_lineas(factura_id,ordinal,origen,descripcion,cantidad,importe_unitario,subtotal,importe_total,snapshot)
    VALUES(n,1,'AJUSTE','Crédito',1,monto,monto,monto,'{"ordinalOriginal":1}');
    UPDATE public.facturas_electronicas SET estado='ENVIANDO' WHERE id=n;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('tenant_id',t,'role','authenticated','sub',u)::text,true);
    BEGIN
      PERFORM public.rpc_facturacion_reservar_devoluciones(n,jsonb_build_array(jsonb_build_object('operacionLineaId',l,'cantidad',entregadas+1)));
      RAISE EXCEPTION 'Se permitió devolver unidades sin entregar';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%saldo físico disponible%' THEN RAISE; END IF;
    END;
    PERFORM public.rpc_facturacion_reservar_devoluciones(n,
      CASE WHEN devueltas>0 THEN jsonb_build_array(jsonb_build_object('operacionLineaId',l,'cantidad',devueltas)) ELSE '[]'::jsonb END);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('tenant_id',t,'role','service_role')::text,true);
    PERFORM public.rpc_facturacion_finalizar_nc(t,n,'12345678901234',current_date+10);
    PERFORM public.rpc_facturacion_finalizar_nc(t,n,'12345678901234',current_date+10);
    SELECT * INTO r FROM public.operaciones_lineas WHERE id=l;
    IF r.cantidad_cancelada <> canceladas OR r.cantidad_cumplida <> entregadas THEN
      RAISE EXCEPTION 'NC caso %: canceladas %, cumplidas %',caso,r.cantidad_cancelada,r.cantidad_cumplida;
    END IF;
    IF (SELECT cantidad_reservada FROM public.stocks WHERE id=s) <> reserva_previa+5-entregadas-canceladas THEN RAISE EXCEPTION 'Reserva incorrecta'; END IF;
    IF (SELECT cantidad FROM public.stocks WHERE id=s) <> saldo_previo-entregadas+devueltas THEN RAISE EXCEPTION 'Stock físico incorrecto'; END IF;
    IF (SELECT count(*) FROM public.facturacion_nc_devoluciones WHERE nota_credito_id=n AND operacion_ajuste_id IS NOT NULL)
      <> (CASE WHEN devueltas>0 THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Devolución faltante o duplicada'; END IF;
  END LOOP;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
