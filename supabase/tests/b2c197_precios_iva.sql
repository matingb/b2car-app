-- Run with psql -v ON_ERROR_STOP=1 against an isolated, migrated, seeded DB.
-- No ARCA calls. Entire fixture rolls back. Not run automatically during migration.
BEGIN;
DO $test$
DECLARE
  t uuid := gen_random_uuid(); c uuid := gen_random_uuid(); v uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); d uuid := gen_random_uuid(); f uuid := gen_random_uuid();
  r public.arreglos; before_row jsonb; fiscal_state text; budget uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role','tenant_id',t)::text, true);
  INSERT INTO public.tenants(id,nombre) VALUES(t,'B2C197 rollback fixture');
  INSERT INTO public.clientes(id,tenant_id) VALUES(c,t);
  INSERT INTO public.vehiculos(id,cliente_id,tenant_id,patente,marca,modelo)
    VALUES(v,c,t,'B2C197-'||left(v::text,8),'Test','Test');
  INSERT INTO public.arreglos(id,vehiculo_id,tenant_id,precio_final,precio_sin_iva)
    VALUES(a,v,t,777,642.15);
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  ASSERT r.precios_incluyen_iva AND r.tasa_iva IS NULL AND r.precio_final=777,
    'legacy insert must not recalculate money';
  INSERT INTO public.detalle_arreglo(id,arreglo_id,tenant_id,descripcion,cantidad,horas_facturadas,precio_hora_facturada)
    VALUES(d,a,t,'Servicio',2,1.5,100);
  INSERT INTO public.detalle_form_custom(arreglo_id,tenant_id,costo) VALUES(a,t,50);
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  ASSERT r.precio_final=350, 'custom form is included in the commercial total';
  UPDATE public.detalle_form_custom SET costo=60 WHERE arreglo_id=a;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=360,
    'editing custom cost recalculates even without an IVA snapshot';
  UPDATE public.detalle_form_custom SET costo=50 WHERE arreglo_id=a;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=350,
    'restoring custom cost recalculates without changing IVA mode';
  SELECT to_jsonb(x)-'updated_at' INTO before_row FROM public.arreglos x WHERE id=a;
  UPDATE public.arreglos SET precios_incluyen_iva=true,observaciones=observaciones WHERE id=a;
  ASSERT (SELECT to_jsonb(x)-'updated_at' FROM public.arreglos x WHERE id=a)=before_row,
    'same-value mode update must not recalculate';
  BEGIN
    UPDATE public.arreglos SET precios_incluyen_iva=false WHERE id=a;
    RAISE EXCEPTION 'missing snapshot accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','tenant_id',t,'user_role','no-permission','plan_sub','BASE')::text,true);
  BEGIN
    UPDATE public.arreglos SET precios_incluyen_iva=false,tasa_iva=.21 WHERE id=a;
    RAISE EXCEPTION 'permission bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role','tenant_id',t)::text,true);
  UPDATE public.arreglos SET precios_incluyen_iva=false,tasa_iva=.21,precio_final=1 WHERE id=a;
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  ASSERT r.precio_final=423.50 AND r.precio_sin_iva=350 AND NOT r.esta_pago,
    'gross from services/hours/form, never client total';
  ASSERT (SELECT precio_hora_facturada FROM public.detalle_arreglo WHERE id=d)=100,'unit price mutated';
  ASSERT public.calcular_precio_final_arreglo(a)=423.50, 'snapshot recalculation';
  UPDATE public.detalle_form_custom SET costo=100 WHERE arreglo_id=a;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=484,'form trigger';
  UPDATE public.detalle_arreglo SET precio_hora_facturada=200 WHERE id=d;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=847,'service trigger preserves snapshot';
  UPDATE public.arreglos SET precios_incluyen_iva=true,tasa_iva=.21 WHERE id=a;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=700,'reverse toggle';
  UPDATE public.arreglos SET precios_incluyen_iva=false,tasa_iva=.21 WHERE id=a;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=a)=847,'round trip drift';
  BEGIN
    UPDATE public.arreglos SET tasa_iva=.10 WHERE id=a;
    RAISE EXCEPTION 'independent snapshot overwrite accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  UPDATE public.arreglos SET total_cobrado=1 WHERE id=a;
  BEGIN
    UPDATE public.arreglos SET precios_incluyen_iva=true,tasa_iva=.21,total_cobrado=0 WHERE id=a;
    RAISE EXCEPTION 'partial collection bypass';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
  UPDATE public.arreglos SET total_cobrado=847 WHERE id=a;
  BEGIN
    UPDATE public.arreglos SET precios_incluyen_iva=true,tasa_iva=.21 WHERE id=a;
    RAISE EXCEPTION 'full collection bypass';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
  UPDATE public.arreglos SET precios_incluyen_iva=false,observaciones='same value allowed' WHERE id=a;
  UPDATE public.arreglos SET total_cobrado=0 WHERE id=a;
  INSERT INTO public.facturas_electronicas(id,tenant_id,arreglo_id,idempotency_key,estado,
    emisor_snapshot,receptor_snapshot,concepto,fecha_comprobante,total,punto_venta)
    VALUES(f,t,a,gen_random_uuid(),'ENVIANDO','{}','{}',2,current_date,847,1);
  FOREACH fiscal_state IN ARRAY ARRAY['ENVIANDO','INCIERTA','AUTORIZADA'] LOOP
    UPDATE public.facturas_electronicas SET estado=fiscal_state WHERE id=f;
    BEGIN
      UPDATE public.arreglos SET precios_incluyen_iva=true,tasa_iva=.21 WHERE id=a;
      RAISE EXCEPTION 'fiscal lock bypass: %',fiscal_state;
    EXCEPTION WHEN SQLSTATE '55001' THEN NULL; END;
  END LOOP;
  INSERT INTO public.arreglos(id,vehiculo_id,tenant_id,estado,repuestos_pendientes)
    VALUES(budget,v,t,'PRESUPUESTO','[{"cantidad":3,"monto_unitario":0.01}]');
  UPDATE public.arreglos SET precios_incluyen_iva=false,tasa_iva=.21 WHERE id=budget;
  ASSERT (SELECT precio_final FROM public.arreglos WHERE id=budget)=.04,'pending budget line rounding';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','tenant_id',gen_random_uuid())::text,true);
  BEGIN
    PERFORM public.calcular_precio_final_arreglo(a);
    RAISE EXCEPTION 'cross tenant calculation exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT public.importe_comercial_arreglo(.03,false,.21)=.04,'extended subtotal rounding';
  ASSERT public.importe_comercial_arreglo(100,false,0)=100,'zero commercial rate';
  ASSERT public.importe_comercial_arreglo(100,false,.105)=110.50,'nondefault commercial rate';
  ASSERT public.importe_comercial_arreglo(100.123,true,NULL)=100.123,'legacy rounding unchanged';
END;
$test$;
ROLLBACK;
