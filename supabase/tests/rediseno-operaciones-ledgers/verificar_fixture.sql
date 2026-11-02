BEGIN;
DO $$
DECLARE t record; c record; o uuid;
BEGIN
  FOR t IN SELECT id,nombre FROM public.tenants WHERE nombre LIKE 'fixture-ledgers-%' LOOP
    IF EXISTS (SELECT 1 FROM public.operaciones WHERE tenant_id=t.id AND tipo IN ('COMPRA','VENTA') AND total_pagado<>monto_total) THEN
      RAISE EXCEPTION 'Documento sin saldar';
    END IF;
    IF EXISTS (SELECT 1 FROM public.cuentas_financieras cf WHERE cf.tenant_id=t.id
      AND cf.saldo <> CASE WHEN t.nombre='fixture-ledgers-1' AND cf.nombre='Primera' THEN -500 ELSE 0 END) THEN
      RAISE EXCEPTION 'Saldo alterado en %',t.nombre;
    END IF;
    IF EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta m JOIN public.operaciones op ON op.id=m.operacion_id
      WHERE op.tenant_id=t.id AND op.tipo IN ('COMPRA','VENTA') AND m.cuenta_id<>(
        SELECT id FROM public.cuentas_financieras WHERE tenant_id=t.id AND activo ORDER BY favorita DESC,created_at,id LIMIT 1)) THEN
      RAISE EXCEPTION 'Cuenta de regularización incorrecta';
    END IF;
    IF t.nombre='fixture-ledgers-3' AND EXISTS (SELECT 1 FROM public.operaciones WHERE tenant_id=t.id AND tipo='AJUSTE_FINANCIERO') THEN
      RAISE EXCEPTION 'Ajuste innecesario de neto cero';
    END IF;
  END LOOP;
  SELECT cf.id,cf.saldo,cf.tenant_id INTO c FROM public.cuentas_financieras cf JOIN public.tenants tenant ON tenant.id=cf.tenant_id
  WHERE tenant.nombre='fixture-ledgers-1' AND cf.nombre='Primera';
  SELECT id INTO o FROM public.operaciones WHERE tenant_id=c.tenant_id AND tipo='GASTO';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('tenant_id',c.tenant_id,'role','service_role')::text,true);
  PERFORM public.rpc_actualizar_movimiento_cuenta(p_operacion_id=>o,p_importe=>700);
  IF (SELECT saldo FROM public.cuentas_financieras WHERE id=c.id)<>-700 THEN RAISE EXCEPTION 'Edición histórica incorrecta'; END IF;
  PERFORM public.rpc_eliminar_movimiento_cuenta(o);
  IF (SELECT saldo FROM public.cuentas_financieras WHERE id=c.id)<>0 THEN RAISE EXCEPTION 'Anulación histórica incorrecta'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
