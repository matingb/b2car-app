-- El saldo de cuenta corriente es neto: positivo = deuda, negativo = saldo a favor.
CREATE OR REPLACE FUNCTION public.rpc_cliente_resumen_financiero(
  p_cliente_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id                  uuid := public.current_tenant_id();
  v_saldo_cuenta               numeric := 0;
  v_saldo_a_facturar           numeric := 0;
  v_total_historico_trabajos   numeric := 0;
  v_total_historico_cobrado    numeric := 0;
  v_cant_pendientes_pago       integer := 0;
  v_cant_pendientes_factura    integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id requerido' USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COALESCE(SUM(COALESCE(a.total_cobrado, 0)), 0),
    COALESCE(SUM(COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)), 0),
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.precio_final, 0) > COALESCE(a.total_cobrado, 0))::integer
  INTO
    v_total_historico_trabajos,
    v_total_historico_cobrado,
    v_saldo_cuenta,
    v_cant_pendientes_pago
  FROM public.arreglos a
  WHERE a.tenant_id = v_tenant_id
    AND a.cliente_id = p_cliente_id
    AND a.estado != 'PRESUPUESTO';

  SELECT
    COALESCE(SUM(COALESCE(a.precio_final, 0)), 0),
    COUNT(*)::integer
  INTO
    v_saldo_a_facturar,
    v_cant_pendientes_factura
  FROM public.arreglos a
  WHERE a.tenant_id = v_tenant_id
    AND a.cliente_id = p_cliente_id
    AND a.estado != 'PRESUPUESTO'
    AND a.es_facturable = true
    AND COALESCE(a.precio_final, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas fe
      WHERE fe.tenant_id = v_tenant_id
        AND fe.arreglo_id = a.id
        AND fe.estado = 'AUTORIZADA'
    );

  RETURN jsonb_build_object(
    'saldo_cuenta',                         v_saldo_cuenta,
    'saldo_a_facturar',                     v_saldo_a_facturar,
    'total_historico_trabajos',             v_total_historico_trabajos,
    'total_historico_cobrado',              v_total_historico_cobrado,
    'cantidad_arreglos_pendientes_pago',    v_cant_pendientes_pago,
    'cantidad_arreglos_pendientes_factura', v_cant_pendientes_factura
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO authenticated, service_role;
