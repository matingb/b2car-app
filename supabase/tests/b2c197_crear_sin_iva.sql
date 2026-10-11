-- Run with psql -v ON_ERROR_STOP=1 against an isolated, migrated, seeded DB.
-- Covers creating arreglos with precios sin IVA via rpc_crear_arreglo_completo. Entire fixture rolls back.
BEGIN;
DO $test$
DECLARE
  t uuid := gen_random_uuid(); c uuid := gen_random_uuid(); v uuid := gen_random_uuid();
  tal uuid := gen_random_uuid(); a uuid; r public.arreglos;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role','tenant_id',t,'plan_sub','PRO')::text, true);
  INSERT INTO public.tenants(id,nombre) VALUES(t,'crear sin iva');
  INSERT INTO public.clientes(id,tenant_id) VALUES(c,t);
  INSERT INTO public.vehiculos(id,cliente_id,tenant_id,patente,marca,modelo) VALUES(v,c,t,'SINIVA-'||left(v::text,6),'T','T');
  INSERT INTO public.talleres(id,nombre,ubicacion,tenant_id) VALUES(tal,'T','X',t);

  -- Operativo, sin IVA
  a := public.rpc_crear_arreglo_completo(v, tal, 'SIN_INICIAR', 'x', 0, now(), null, 0, 0, false, null,
    '[{"descripcion":"MO","cantidad":1,"horas_facturadas":1,"precio_hora_facturada":10000}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, true, 0.21, false);
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  RAISE NOTICE 'operativo sin iva: incluye=% tasa=% final=% sin_iva=%', r.precios_incluyen_iva, r.tasa_iva, r.precio_final, r.precio_sin_iva;
  ASSERT NOT r.precios_incluyen_iva AND r.tasa_iva=0.21 AND r.precio_final=12100 AND r.precio_sin_iva=10000, 'operativo sin iva';

  -- Presupuesto, sin IVA
  a := public.rpc_crear_arreglo_completo(v, tal, 'PRESUPUESTO', 'x', 0, now(), null, 0, 0, false, null,
    '[{"descripcion":"MO","cantidad":1,"horas_facturadas":1,"precio_hora_facturada":10000}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, false, 0.21, false);
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  RAISE NOTICE 'presupuesto sin iva: incluye=% final=% sin_iva=%', r.precios_incluyen_iva, r.precio_final, r.precio_sin_iva;
  ASSERT NOT r.precios_incluyen_iva AND r.precio_final=12100 AND r.precio_sin_iva=10000, 'presupuesto sin iva';

  -- Default con IVA
  a := public.rpc_crear_arreglo_completo(v, tal, 'SIN_INICIAR', 'x', 0, now(), null, 0, 0, false, null,
    '[{"descripcion":"MO","cantidad":1,"horas_facturadas":1,"precio_hora_facturada":12100}]'::jsonb);
  SELECT * INTO r FROM public.arreglos WHERE id=a;
  RAISE NOTICE 'default: incluye=% tasa=% final=% sin_iva=%', r.precios_incluyen_iva, r.tasa_iva, r.precio_final, r.precio_sin_iva;
  ASSERT r.precios_incluyen_iva AND r.tasa_iva IS NULL AND r.precio_final=12100 AND r.precio_sin_iva=10000, 'default con iva';

  -- Sin permiso de precios
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','tenant_id',t,'user_role','no-permission','plan_sub','PRO')::text,true);
  BEGIN
    a := public.rpc_crear_arreglo_completo(v, tal, 'SIN_INICIAR', 'x', 0, now(), null, 0, 0, false, null,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, null, null, null, null, true, 0.21, false);
    RAISE EXCEPTION 'permission bypass';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'sin permiso: rechazado OK';
  END;
END;
$test$;
ROLLBACK;
