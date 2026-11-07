-- Verifica que una venta con comprobante fiscal AUTORIZADA, ENVIANDO o INCIERTA
-- no se pueda modificar (igual que los arreglos), y que con RECHAZADA sí.
-- Los cambios operativos (pagos) siguen permitidos.
--
-- Correr con psql -v ON_ERROR_STOP=1 contra una base local migrada, por ejemplo:
--   docker exec -i supabase_db_b2car-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/ventas_bloqueo_factura_en_curso.sql
-- No llama a ARCA. Todo el fixture hace ROLLBACK.
BEGIN;

DO $test$
DECLARE
  t uuid := gen_random_uuid(); taller uuid := gen_random_uuid(); prod uuid := gen_random_uuid();
  st uuid := gen_random_uuid(); venta uuid := gen_random_uuid(); linea uuid := gen_random_uuid();
  factura uuid := gen_random_uuid(); ajuste uuid := gen_random_uuid(); ajuste_linea uuid := gen_random_uuid();
  estado_bloqueante text;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'tenant_id', t)::text, true);
  INSERT INTO public.tenants (id, nombre) VALUES (t, 'Bloqueo ventas rollback fixture');
  INSERT INTO public.talleres (id, tenant_id, nombre, ubicacion) VALUES (taller, t, 'Taller', 'Test');
  INSERT INTO public.productos (id, tenant_id, codigo, nombre) VALUES (prod, t, 'BLQ-1', 'Producto');
  INSERT INTO public.stocks (id, tenant_id, taller_id, producto_id) VALUES (st, t, taller, prod);
  -- El stock se deriva del kardex: se carga con un AJUSTE de entrada, como en la app.
  INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, monto_total) VALUES (ajuste, t, 'AJUSTE', taller, 0);
  INSERT INTO public.operaciones_ajuste (operacion_id, tenant_id, motivo) VALUES (ajuste, t, 'INICIAL');
  INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, sentido)
    VALUES (ajuste_linea, ajuste, st, 10, 0, 1);
  INSERT INTO public.operaciones_movimiento_stock (tenant_id, operacion_id, operacion_linea_id, stock_id, cantidad, fecha, motivo)
    VALUES (t, ajuste, ajuste_linea, st, 10, now(), 'Stock inicial del fixture');
  INSERT INTO public.operaciones (id, tenant_id, tipo, taller_id, monto_total) VALUES (venta, t, 'VENTA', taller, 200);
  INSERT INTO public.operaciones_lineas (id, operacion_id, stock_id, cantidad, monto_unitario, sentido)
    VALUES (linea, venta, st, 2, 100, -1);
  INSERT INTO public.facturas_electronicas (
    id, tenant_id, operacion_id, origen_tipo, idempotency_key, estado, ambiente,
    emisor_snapshot, receptor_snapshot, concepto, fecha_comprobante, total, punto_venta
  ) VALUES (
    factura, t, venta, 'VENTA', gen_random_uuid(), 'ENVIANDO', 'HOMOLOGACION',
    jsonb_build_object('cuit', '20111111112'), '{}'::jsonb, 1, current_date, 200, 1
  );

  -- Los mensajes de control no mencionan "comprobante fiscal": si una acción no se
  -- bloquea, su RAISE se re-lanza en el handler y el test falla.
  FOREACH estado_bloqueante IN ARRAY ARRAY['ENVIANDO', 'INCIERTA'] LOOP
    UPDATE public.facturas_electronicas SET estado = estado_bloqueante WHERE id = factura;

    BEGIN
      UPDATE public.operaciones SET observaciones = 'cambio' WHERE id = venta;
      RAISE EXCEPTION 'venta editable con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    BEGIN
      UPDATE public.operaciones_lineas SET cantidad = 1 WHERE id = linea;
      RAISE EXCEPTION 'línea editable con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    BEGIN
      INSERT INTO public.operaciones_lineas (operacion_id, stock_id, cantidad, monto_unitario, sentido)
        VALUES (venta, st, 1, 100, -1);
      RAISE EXCEPTION 'se agregó una línea con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    BEGIN
      DELETE FROM public.operaciones_lineas WHERE id = linea;
      RAISE EXCEPTION 'se borró una línea con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    BEGIN
      PERFORM public.rpc_actualizar_operacion(venta, NULL, 'cambio por RPC');
      RAISE EXCEPTION 'rpc_actualizar_operacion editó con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    BEGIN
      PERFORM public.rpc_borrar_operacion_con_stock(venta);
      RAISE EXCEPTION 'rpc_borrar_operacion_con_stock borró con factura %', estado_bloqueante;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
    END;

    -- Los pagos no tocan datos fiscales y deben seguir funcionando.
    UPDATE public.operaciones SET total_pagado = 50 WHERE id = venta;
  END LOOP;

  -- Con la factura rechazada la venta vuelve a ser editable para corregirla y reintentar.
  UPDATE public.facturas_electronicas SET estado = 'RECHAZADA' WHERE id = factura;
  UPDATE public.operaciones SET observaciones = 'corregida' WHERE id = venta;
  PERFORM public.rpc_actualizar_operacion(venta, NULL, 'corregida por RPC');
  ASSERT (SELECT observaciones FROM public.operaciones WHERE id = venta) = 'corregida por RPC',
    'una venta con factura rechazada debe poder editarse';

  -- El bloqueo con factura autorizada se mantiene.
  UPDATE public.facturas_electronicas SET estado = 'AUTORIZADA' WHERE id = factura;
  BEGIN
    UPDATE public.operaciones SET observaciones = 'cambio' WHERE id = venta;
    RAISE EXCEPTION 'venta editable con factura AUTORIZADA';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%comprobante fiscal%' THEN RAISE; END IF;
  END;
END;
$test$;

ROLLBACK;
