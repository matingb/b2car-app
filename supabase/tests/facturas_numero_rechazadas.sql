-- Verifica el índice facturas_electronicas_numero_emisor_unico:
-- un comprobante RECHAZADA no retiene su número, el resto de los estados sí.
--
-- Correr con psql -v ON_ERROR_STOP=1 contra una base local migrada, por ejemplo:
--   docker exec -i supabase_db_b2car-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/facturas_numero_rechazadas.sql
-- No llama a ARCA. Todo el fixture hace ROLLBACK.
BEGIN;

CREATE FUNCTION pg_temp.arreglo_fixture(p_tenant uuid, p_vehiculo uuid) RETURNS uuid
LANGUAGE sql AS $$
  INSERT INTO public.arreglos (vehiculo_id, tenant_id) VALUES (p_vehiculo, p_tenant)
  RETURNING id;
$$;

-- Mismo emisor, punto de venta y tipo (Factura C) en todos los casos: sólo cambia el número.
CREATE FUNCTION pg_temp.factura_fixture(p_tenant uuid, p_arreglo uuid, p_estado text, p_numero integer)
RETURNS uuid
LANGUAGE sql AS $$
  INSERT INTO public.facturas_electronicas (
    tenant_id, arreglo_id, idempotency_key, estado, ambiente,
    emisor_snapshot, receptor_snapshot, concepto, fecha_comprobante,
    total, punto_venta, tipo_comprobante, numero_comprobante
  ) VALUES (
    p_tenant, p_arreglo, gen_random_uuid(), p_estado, 'HOMOLOGACION',
    jsonb_build_object('cuit', '20111111112'), '{}'::jsonb, 2, current_date,
    1000, 1, 11, p_numero
  )
  RETURNING id;
$$;

DO $test$
DECLARE
  t uuid := gen_random_uuid(); c uuid := gen_random_uuid(); v uuid := gen_random_uuid();
  rechazada uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'tenant_id', t)::text, true);
  INSERT INTO public.tenants (id, nombre) VALUES (t, 'Numeración rechazadas rollback fixture');
  INSERT INTO public.clientes (id, tenant_id) VALUES (c, t);
  INSERT INTO public.vehiculos (id, cliente_id, tenant_id, patente, marca, modelo)
    VALUES (v, c, t, 'NUMRECH-' || left(v::text, 8), 'Test', 'Test');

  -- 1. Un documento en curso retiene su número frente a otro origen.
  rechazada := pg_temp.factura_fixture(t, pg_temp.arreglo_fixture(t, v), 'ENVIANDO', 100);
  BEGIN
    PERFORM pg_temp.factura_fixture(t, pg_temp.arreglo_fixture(t, v), 'ENVIANDO', 100);
    RAISE EXCEPTION 'un número en ENVIANDO fue reutilizado por otro documento';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 2. Al quedar RECHAZADA libera el número: otro origen recibe el mismo candidato de ARCA.
  UPDATE public.facturas_electronicas SET estado = 'RECHAZADA' WHERE id = rechazada;
  PERFORM pg_temp.factura_fixture(t, pg_temp.arreglo_fixture(t, v), 'AUTORIZADA', 100);
  ASSERT (SELECT numero_comprobante FROM public.facturas_electronicas WHERE id = rechazada) = 100,
    'la fila rechazada debe conservar su número como historial';

  -- 3. Si la rechazada volviera a un estado activo con el número viejo, reingresa al índice y choca.
  BEGIN
    UPDATE public.facturas_electronicas SET estado = 'ENVIANDO' WHERE id = rechazada;
    RAISE EXCEPTION 'una factura rechazada recuperó un número ya autorizado';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 4. El reintento real (rpc_facturacion_preparar_documento) asigna un candidato nuevo.
  UPDATE public.facturas_electronicas SET estado = 'ENVIANDO', numero_comprobante = 101 WHERE id = rechazada;

  -- 5. INCIERTA sigue reteniendo el número: ARCA podría haberlo autorizado.
  PERFORM pg_temp.factura_fixture(t, pg_temp.arreglo_fixture(t, v), 'INCIERTA', 102);
  BEGIN
    PERFORM pg_temp.factura_fixture(t, pg_temp.arreglo_fixture(t, v), 'ENVIANDO', 102);
    RAISE EXCEPTION 'un número en INCIERTA fue reutilizado por otro documento';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$test$;

ROLLBACK;
