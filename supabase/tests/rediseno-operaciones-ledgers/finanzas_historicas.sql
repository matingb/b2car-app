-- Sobre la copia local migrada: editar y anular el gasto histórico real, siempre con rollback.
BEGIN;
DO $$
DECLARE o record; c record;
BEGIN
  SELECT op.id,op.tenant_id,m.cuenta_id,op.monto_total INTO o
  FROM public.operaciones op JOIN public.operaciones_movimiento_cuenta m ON m.operacion_id=op.id
  WHERE op.id='035d8b28-a9ea-4817-b2ec-4fe342ee9c13';
  IF NOT FOUND THEN RAISE EXCEPTION 'Este ensayo requiere la copia local de producción'; END IF;
  SELECT id,saldo INTO c FROM public.cuentas_financieras WHERE id=o.cuenta_id;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('tenant_id',o.tenant_id,'role','service_role')::text,true);
  PERFORM public.rpc_actualizar_movimiento_cuenta(p_operacion_id=>o.id,p_importe=>700);
  IF (SELECT saldo FROM public.cuentas_financieras WHERE id=c.id) <> c.saldo+o.monto_total-700 THEN
    RAISE EXCEPTION 'Saldo incorrecto al editar el gasto histórico';
  END IF;
  PERFORM public.rpc_eliminar_movimiento_cuenta(o.id);
  IF (SELECT saldo FROM public.cuentas_financieras WHERE id=c.id) <> c.saldo+o.monto_total THEN
    RAISE EXCEPTION 'Saldo incorrecto al anular el gasto histórico';
  END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
