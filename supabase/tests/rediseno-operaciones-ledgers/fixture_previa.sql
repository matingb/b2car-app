\set ON_ERROR_STOP on
-- Ejecutar en la base LOCAL reseteada a 20261017100000, antes de la cadena pendiente.
BEGIN;
ALTER TABLE public.movimientos_financieros DISABLE TRIGGER movimientos_financieros_bloquear_mutacion;
DO $$
DECLARE t uuid; w uuid; p uuid; s uuid; c uuid; op uuid; i integer; j integer;
BEGIN
  FOR i IN 1..4 LOOP
    INSERT INTO public.tenants(nombre, plan_sub) VALUES ('fixture-ledgers-' || i, 'PRO') RETURNING id INTO t;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('tenant_id', t, 'role', 'service_role')::text, true);
    INSERT INTO public.talleres(tenant_id,nombre,ubicacion) VALUES(t,'Taller','Local') RETURNING id INTO w;
    INSERT INTO public.productos(tenant_id,codigo,nombre) VALUES(t,'FIX','Producto') RETURNING id INTO p;
    INSERT INTO public.stocks(tenant_id,taller_id,producto_id,cantidad) VALUES(t,w,p,100) RETURNING id INTO s;
    INSERT INTO public.cuentas_financieras(tenant_id,nombre,tipo,favorita,created_at)
    VALUES(t,'Primera','EFECTIVO',i <> 2, '2020-01-01') RETURNING id INTO c;
    IF i = 2 THEN
      INSERT INTO public.cuentas_financieras(tenant_id,nombre,tipo,activo,created_at)
      VALUES(t,'Anterior inactiva','EFECTIVO',false,'2019-01-01');
    END IF;
    IF i = 1 THEN
      UPDATE public.cuentas_financieras SET favorita=false WHERE id=c;
      INSERT INTO public.cuentas_financieras(tenant_id,nombre,tipo,favorita,created_at)
      VALUES(t,'Favorita','EFECTIVO',true,'2021-01-01');
    END IF;
    FOR j IN 1..2 LOOP
      INSERT INTO public.operaciones(tenant_id,taller_id,tipo,observaciones)
      VALUES(t,w,CASE WHEN j=1 THEN 'COMPRA'::public.tipo_operacion ELSE 'VENTA'::public.tipo_operacion END,'Sin asiento') RETURNING id INTO op;
      INSERT INTO public.operaciones_lineas(operacion_id,stock_id,cantidad,monto_unitario,delta_cantidad)
      VALUES(op,s,1,CASE WHEN i=4 AND j=2 THEN 160 WHEN i=3 OR j=1 THEN 100 ELSE 40 END,CASE WHEN j=1 THEN 1 ELSE -1 END);
    END LOOP;
    IF i=1 THEN
      -- Patrón real: tres ediciones sin cambio de monto, y una de 481 a 500.
      op := public.rpc_crear_movimiento_cuenta(p_subtipo=>'GASTO',p_cuenta_id=>c,p_importe=>481,p_categoria_gasto=>'OTROS',p_descripcion=>'Gasto editado');
      UPDATE public.movimientos_financieros SET created_at='2026-10-12' WHERE operacion_id=op;
      FOR j IN 1..4 LOOP
        UPDATE public.operaciones_movimiento_cuenta SET importe=CASE WHEN j=4 THEN -500 ELSE -481 END WHERE operacion_id=op;
        UPDATE public.movimientos_financieros SET created_at='2026-10-16'::timestamptz + j*interval '1 day'
        WHERE operacion_id=op AND created_at=now();
      END LOOP;
      INSERT INTO public.operaciones(tenant_id,taller_id,tipo) VALUES(t,w,'ASIGNACION_ARREGLO');
    END IF;
  END LOOP;
END $$;
ALTER TABLE public.movimientos_financieros ENABLE TRIGGER movimientos_financieros_bloquear_mutacion;
COMMIT;

