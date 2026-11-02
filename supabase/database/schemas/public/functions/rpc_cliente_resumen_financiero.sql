CREATE FUNCTION public.rpc_cliente_resumen_financiero (
  p_cliente_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id                  uuid := public.current_tenant_id();
  v_saldo_cuenta               numeric := 0;
  v_saldo_a_facturar           numeric := 0;
  v_total_historico_trabajos   numeric := 0;
  v_total_historico_cobrado    numeric := 0;
  v_cant_pendientes_pago       integer := 0;
  v_cant_pendientes_factura    integer := 0;

  v_total_ventas               numeric := 0;
  v_cobrado_ventas             numeric := 0;
  v_cant_ventas_pendientes     integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id requerido' USING ERRCODE = '22023';
  END IF;

  -- 1. Arreglos (vinculados directamente o mediante el vehículo asociado)
  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COALESCE(SUM(COALESCE(a.total_cobrado, 0)), 0),
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.precio_final, 0) > COALESCE(a.total_cobrado, 0))::integer
  INTO
    v_total_historico_trabajos,
    v_total_historico_cobrado,
    v_cant_pendientes_pago
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.tenant_id = v_tenant_id
    AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
    AND a.estado != 'PRESUPUESTO';

  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COUNT(*)::integer
  INTO
    v_saldo_a_facturar,
    v_cant_pendientes_factura
  FROM public.arreglos a
  LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
  WHERE a.tenant_id = v_tenant_id
    AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
    AND a.estado != 'PRESUPUESTO'
    AND a.es_facturable = true
    AND COALESCE(a.precio_final, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas fe
      WHERE fe.tenant_id = v_tenant_id
        AND fe.arreglo_id = a.id
        AND fe.estado = 'AUTORIZADA'
    );

  -- 2. Ventas directas de productos
  SELECT
    COALESCE(SUM(COALESCE(o.monto_total, 0)), 0),
    COALESCE(SUM(COALESCE(o.total_pagado, 0)), 0),
    COUNT(*) FILTER (WHERE o.esta_pago = false AND COALESCE(o.monto_total, 0) > COALESCE(o.total_pagado, 0))::integer
  INTO
    v_total_ventas,
    v_cobrado_ventas,
    v_cant_ventas_pendientes
  FROM public.operaciones_venta ov
  JOIN public.operaciones o ON o.id = ov.operacion_id
  WHERE ov.tenant_id = v_tenant_id
    AND ov.cliente_id = p_cliente_id
    AND o.tipo = 'VENTA';

  v_total_historico_trabajos := v_total_historico_trabajos + v_total_ventas;
  v_total_historico_cobrado := v_total_historico_cobrado + v_cobrado_ventas;
  v_cant_pendientes_pago := v_cant_pendientes_pago + v_cant_ventas_pendientes;

  -- 3. Saldo unificado de cuenta corriente (desde rpc_clientes_saldos)
  SELECT COALESCE(s.saldo, 0)
  INTO v_saldo_cuenta
  FROM public.rpc_clientes_saldos(ARRAY[p_cliente_id]) s;

  RETURN jsonb_build_object(
    'saldo_cuenta',                         v_saldo_cuenta,
    'saldo_a_facturar',                     v_saldo_a_facturar,
    'total_historico_trabajos',             v_total_historico_trabajos,
    'total_historico_cobrado',              v_total_historico_cobrado,
    'cantidad_arreglos_pendientes_pago',    v_cant_pendientes_pago,
    'cantidad_arreglos_pendientes_factura', v_cant_pendientes_factura
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO anon;

GRANT ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO service_role;