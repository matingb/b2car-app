CREATE FUNCTION public._operacion_validar_documento_id (
  v_op_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_op record;
  v_omc_count integer;
  v_omc_sum numeric;
  v_hija_ingreso record;
  v_hija_trans record;
  v_hija_apertura record;
  v_hija_mov_prov record;
  v_hija_mov_cli record;
  v_omc_rec record;
BEGIN
  SELECT id, tenant_id, taller_id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = v_op_id;

  -- Si la operación fue eliminada en cascada en la misma transacción, finalizar
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT 'COMPRA' AS tipo FROM public.operaciones_compra WHERE operacion_id = v_op_id
      UNION ALL SELECT 'VENTA' FROM public.operaciones_venta WHERE operacion_id = v_op_id
      UNION ALL SELECT 'GASTO' FROM public.operaciones_gasto WHERE operacion_id = v_op_id
      UNION ALL SELECT 'ASIGNACION_ARREGLO' FROM public.operaciones_asignacion_arreglo WHERE operacion_id = v_op_id
      UNION ALL SELECT 'COBRO_ARREGLO' FROM public.operaciones_cobro_arreglo WHERE operacion_id = v_op_id
      UNION ALL SELECT 'AJUSTE' FROM public.operaciones_ajuste WHERE operacion_id = v_op_id
      UNION ALL SELECT 'INGRESO' FROM public.operaciones_ingreso WHERE operacion_id = v_op_id
      UNION ALL SELECT 'TRANSFERENCIA' FROM public.operaciones_transferencia WHERE operacion_id = v_op_id
      UNION ALL SELECT 'APERTURA_CUENTA' FROM public.operaciones_apertura_cuenta WHERE operacion_id = v_op_id
      UNION ALL SELECT 'AJUSTE_FINANCIERO' FROM public.operaciones_ajuste_financiero WHERE operacion_id = v_op_id
      UNION ALL SELECT 'MOVIMIENTO_PROVEEDOR' FROM public.operaciones_movimiento_proveedor WHERE operacion_id = v_op_id
      UNION ALL SELECT 'MOVIMIENTO_CLIENTE' FROM public.operaciones_movimiento_cliente WHERE operacion_id = v_op_id
    ) h HAVING count(*) = 1 AND bool_and(h.tipo = v_op.tipo::text)
  ) THEN
    RAISE EXCEPTION 'Operación % requiere exactamente una hija de tipo %', v_op_id, v_op.tipo USING ERRCODE = '22023';
  END IF;

  -- 0. Coherencia de tenant en taller y líneas de mercadería
  IF v_op.taller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.talleres t WHERE t.id = v_op.taller_id AND t.tenant_id = v_op.tenant_id
  ) THEN
    RAISE EXCEPTION 'El taller % no pertenece al tenant de la operación %', v_op.taller_id, v_op_id USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operaciones_lineas ol
    LEFT JOIN public.stocks s ON s.id = ol.stock_id
    WHERE ol.operacion_id = v_op_id
      AND (s.id IS NULL OR s.tenant_id IS DISTINCT FROM v_op.tenant_id OR (v_op.taller_id IS NOT NULL AND s.taller_id IS DISTINCT FROM v_op.taller_id)
        OR (ol.categoria_arreglo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categorias_arreglo ca WHERE ca.id = ol.categoria_arreglo_id AND ca.tenant_id = v_op.tenant_id))
        OR (ol.empleado_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.empleados e WHERE e.id = ol.empleado_id AND e.tenant_id = v_op.tenant_id)))
  ) THEN
    RAISE EXCEPTION 'Línea de mercadería con stock ajeno al tenant o taller de la operación %', v_op_id USING ERRCODE = '22023';
  END IF;

  -- 1. Operaciones que NO admiten líneas de mercadería
  IF v_op.tipo IN ('GASTO'::public.tipo_operacion,
                   'INGRESO'::public.tipo_operacion,
                   'TRANSFERENCIA'::public.tipo_operacion,
                   'APERTURA_CUENTA'::public.tipo_operacion,
                   'COBRO_ARREGLO'::public.tipo_operacion,
                   'AJUSTE_FINANCIERO'::public.tipo_operacion,
                   'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion,
                   'MOVIMIENTO_CLIENTE'::public.tipo_operacion) THEN
    IF EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación % de tipo % no puede tener líneas de mercadería', v_op_id, v_op.tipo USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 2. Presencia obligatoria y coherencia de tenant de la tabla hija según el tipo de operación
  IF v_op.tipo = 'COMPRA'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_compra oc
      WHERE oc.operacion_id = v_op_id
        AND oc.tenant_id = v_op.tenant_id
        AND (oc.proveedor_id IS NULL OR EXISTS (
          SELECT 1 FROM public.proveedores p WHERE p.id = oc.proveedor_id AND p.tenant_id = v_op.tenant_id
        ))
    ) THEN
      RAISE EXCEPTION 'Operación COMPRA % debe tener su registro válido en operaciones_compra del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'VENTA'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_venta ov
      WHERE ov.operacion_id = v_op_id
        AND ov.tenant_id = v_op.tenant_id
        AND (ov.cliente_id IS NULL OR EXISTS (
          SELECT 1 FROM public.clientes c WHERE c.id = ov.cliente_id AND c.tenant_id = v_op.tenant_id
        ))
    ) THEN
      RAISE EXCEPTION 'Operación VENTA % debe tener su registro válido en operaciones_venta del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'GASTO'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_gasto og
      WHERE og.operacion_id = v_op_id AND og.tenant_id = v_op.tenant_id
    ) THEN
      RAISE EXCEPTION 'Operación GASTO % debe tener su registro en operaciones_gasto', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_asignacion_arreglo oa
      JOIN public.arreglos a ON a.id = oa.arreglo_id
      WHERE oa.operacion_id = v_op_id
        AND oa.tenant_id = v_op.tenant_id
        AND a.tenant_id = v_op.tenant_id
    ) THEN
      RAISE EXCEPTION 'Operación ASIGNACION_ARREGLO % debe tener su registro válido en operaciones_asignacion_arreglo del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'AJUSTE'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_ajuste oaj
      WHERE oaj.operacion_id = v_op_id AND oaj.tenant_id = v_op.tenant_id
    ) THEN
      RAISE EXCEPTION 'Operación AJUSTE % debe tener su registro en operaciones_ajuste', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'INGRESO'::public.tipo_operacion THEN
    SELECT * INTO v_hija_ingreso FROM public.operaciones_ingreso WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación INGRESO % debe tener su registro en operaciones_ingreso', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación INGRESO % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_ingreso.cuenta_id OR v_omc_rec.importe IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de INGRESO no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN
    SELECT * INTO v_hija_apertura FROM public.operaciones_apertura_cuenta WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación APERTURA_CUENTA % debe tener su registro en operaciones_apertura_cuenta', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(ABS(importe)), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación APERTURA_CUENTA % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_apertura.cuenta_id OR ABS(v_omc_rec.importe) IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de APERTURA_CUENTA no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'AJUSTE_FINANCIERO'::public.tipo_operacion THEN
    SELECT * INTO v_hija_apertura FROM public.operaciones_ajuste_financiero
    WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.cuentas_financieras c
      WHERE c.id = v_hija_apertura.cuenta_id AND c.tenant_id = v_op.tenant_id) THEN
      RAISE EXCEPTION 'Ajuste financiero sin cuenta válida del tenant' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_omc_count FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 OR NOT EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta
      WHERE operacion_id = v_op_id AND cuenta_id = v_hija_apertura.cuenta_id AND ABS(importe) = v_op.monto_total) THEN
      RAISE EXCEPTION 'Ajuste financiero requiere exactamente una OMC por su monto y cuenta' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
    SELECT * INTO v_hija_trans FROM public.operaciones_transferencia WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operación TRANSFERENCIA % debe tener su registro en operaciones_transferencia', v_op_id USING ERRCODE = '22023';
    END IF;
    IF v_hija_trans.cuenta_origen_id = v_hija_trans.cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino de TRANSFERENCIA deben ser distintas' USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 2 OR v_omc_sum <> 0 THEN
      RAISE EXCEPTION 'Operación TRANSFERENCIA % debe tener exactamente 2 OMC que sumen 0 (tiene % con suma %)', v_op_id, v_omc_count, v_omc_sum USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id AND cuenta_id = v_hija_trans.cuenta_origen_id AND importe = -v_op.monto_total)
       OR NOT EXISTS (SELECT 1 FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id AND cuenta_id = v_hija_trans.cuenta_destino_id AND importe = v_op.monto_total) THEN
      RAISE EXCEPTION 'Las OMC de TRANSFERENCIA deben coincidir con cuenta_origen (-monto) y cuenta_destino (+monto)' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones_cobro_arreglo oca
      JOIN public.arreglos a ON a.id = oca.arreglo_id
      WHERE oca.operacion_id = v_op_id
        AND oca.tenant_id = v_op.tenant_id
        AND a.tenant_id = v_op.tenant_id
    ) THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener su registro válido en operaciones_cobro_arreglo del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 OR v_omc_sum <> v_op.monto_total THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener exactamente 1 OMC por el monto total', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion THEN
    SELECT * INTO v_hija_mov_prov
    FROM public.operaciones_movimiento_proveedor
    WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND
       OR NOT EXISTS (SELECT 1 FROM public.proveedores p WHERE p.id = v_hija_mov_prov.proveedor_id AND p.tenant_id = v_op.tenant_id)
       OR NOT EXISTS (SELECT 1 FROM public.cuentas_financieras cf WHERE cf.id = v_hija_mov_prov.cuenta_id AND cf.tenant_id = v_op.tenant_id) THEN
      RAISE EXCEPTION 'Operación MOVIMIENTO_PROVEEDOR % debe tener proveedor y cuenta válidos del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_omc_count FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación MOVIMIENTO_PROVEEDOR % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_mov_prov.cuenta_id OR ABS(v_omc_rec.importe) IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de MOVIMIENTO_PROVEEDOR no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion THEN
    SELECT * INTO v_hija_mov_cli
    FROM public.operaciones_movimiento_cliente
    WHERE operacion_id = v_op_id AND tenant_id = v_op.tenant_id;
    IF NOT FOUND
       OR NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = v_hija_mov_cli.cliente_id AND c.tenant_id = v_op.tenant_id)
       OR NOT EXISTS (SELECT 1 FROM public.cuentas_financieras cf WHERE cf.id = v_hija_mov_cli.cuenta_id AND cf.tenant_id = v_op.tenant_id) THEN
      RAISE EXCEPTION 'Operación MOVIMIENTO_CLIENTE % debe tener cliente y cuenta válidos del mismo tenant', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_omc_count FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 THEN
      RAISE EXCEPTION 'Operación MOVIMIENTO_CLIENTE % debe tener exactamente 1 OMC (tiene %)', v_op_id, v_omc_count USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_omc_rec FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id LIMIT 1;
    IF v_omc_rec.cuenta_id IS DISTINCT FROM v_hija_mov_cli.cuenta_id OR ABS(v_omc_rec.importe) IS DISTINCT FROM v_op.monto_total THEN
      RAISE EXCEPTION 'OMC de MOVIMIENTO_CLIENTE no coincide con la cuenta o el monto de la operación' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public._operacion_validar_documento_id(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public._operacion_validar_documento_id(uuid) TO service_role;