-- ============================================================================
-- MIGRATION: 20261108120000_pago_cobro_directo_cuenta_corriente.sql
-- Movimientos directos bidireccionales de Cuenta Corriente para Proveedores y Clientes,
-- siempre vinculados a una cuenta financiera (MOVIMIENTO_PROVEEDOR, MOVIMIENTO_CLIENTE),
-- extracto unificado para Proveedores y paridad de saldos.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas hijas 1:1 para movimientos directos de Cuenta Corriente
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.operaciones_movimiento_proveedor (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  cuenta_id    uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operaciones_movimiento_cliente (
  operacion_id uuid PRIMARY KEY REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cliente_id   uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  cuenta_id    uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índices compuestos por tenant + entidad e índices sobre FK cuenta_id (ON DELETE RESTRICT)
CREATE INDEX IF NOT EXISTS idx_op_mov_prov_proveedor ON public.operaciones_movimiento_proveedor (tenant_id, proveedor_id);
CREATE INDEX IF NOT EXISTS idx_op_mov_prov_cuenta    ON public.operaciones_movimiento_proveedor (cuenta_id);

CREATE INDEX IF NOT EXISTS idx_op_mov_cli_cliente ON public.operaciones_movimiento_cliente (tenant_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_op_mov_cli_cuenta  ON public.operaciones_movimiento_cliente (cuenta_id);

-- -----------------------------------------------------------------------------
-- 2. RLS y Privilegios de mínimo acceso (alineado con 20261101130000)
-- -----------------------------------------------------------------------------

ALTER TABLE public.operaciones_movimiento_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operaciones_movimiento_cliente   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_access ON public.operaciones_movimiento_proveedor;
CREATE POLICY tenant_access ON public.operaciones_movimiento_proveedor
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()))
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1 FROM public.proveedores p
      WHERE p.id = operaciones_movimiento_proveedor.proveedor_id
        AND p.tenant_id = (SELECT public.current_tenant_id())
    )
    AND EXISTS (
      SELECT 1 FROM public.cuentas_financieras cf
      WHERE cf.id = operaciones_movimiento_proveedor.cuenta_id
        AND cf.tenant_id = (SELECT public.current_tenant_id())
    )
  );

DROP POLICY IF EXISTS tenant_access ON public.operaciones_movimiento_cliente;
CREATE POLICY tenant_access ON public.operaciones_movimiento_cliente
  AS PERMISSIVE FOR ALL TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()))
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = operaciones_movimiento_cliente.cliente_id
        AND c.tenant_id = (SELECT public.current_tenant_id())
    )
    AND EXISTS (
      SELECT 1 FROM public.cuentas_financieras cf
      WHERE cf.id = operaciones_movimiento_cliente.cuenta_id
        AND cf.tenant_id = (SELECT public.current_tenant_id())
    )
  );

REVOKE ALL ON TABLE
  public.operaciones_movimiento_proveedor,
  public.operaciones_movimiento_cliente
FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE
  public.operaciones_movimiento_proveedor,
  public.operaciones_movimiento_cliente
TO "authenticated";

GRANT ALL ON TABLE
  public.operaciones_movimiento_proveedor,
  public.operaciones_movimiento_cliente
TO "service_role", "postgres";

-- -----------------------------------------------------------------------------
-- 3. Validación de OMC y Triggers Diferidos de Documento (_operacion_validar_documento_id)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._omc_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op record;
BEGIN
  SELECT o.tenant_id, o.tipo, o.fecha INTO v_op
  FROM public.operaciones o
  WHERE o.id = NEW.operacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', NEW.operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_op.tenant_id THEN
    RAISE EXCEPTION 'Tenant de OMC (%) no coincide con la operación (%)', NEW.tenant_id, v_op.tenant_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(
    NEW.cuenta_id,
    NEW.tenant_id,
    (TG_OP = 'INSERT' OR NEW.cuenta_id IS DISTINCT FROM OLD.cuenta_id)
  );

  NEW.fecha := COALESCE(NEW.fecha, v_op.fecha, now());

  IF v_op.tipo IN ('ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion) THEN
    RAISE EXCEPTION 'Operaciones de tipo % no admiten movimientos de cuenta', v_op.tipo USING ERRCODE = '22023';
  END IF;

  -- Regla de signo según tipo de operación
  IF v_op.tipo IN (
    'VENTA'::public.tipo_operacion,
    'INGRESO'::public.tipo_operacion,
    'COBRO_ARREGLO'::public.tipo_operacion
  ) THEN
    IF NEW.importe <= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser positivo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN (
    'COMPRA'::public.tipo_operacion,
    'GASTO'::public.tipo_operacion
  ) THEN
    IF NEW.importe >= 0 THEN
      RAISE EXCEPTION 'El importe de OMC para % debe ser negativo', v_op.tipo USING ERRCODE = '22023';
    END IF;
  ELSIF v_op.tipo IN (
    'APERTURA_CUENTA'::public.tipo_operacion,
    'TRANSFERENCIA'::public.tipo_operacion,
    'AJUSTE_FINANCIERO'::public.tipo_operacion,
    'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion,
    'MOVIMIENTO_CLIENTE'::public.tipo_operacion
  ) THEN
    IF NEW.importe = 0 THEN
      RAISE EXCEPTION 'El importe de OMC no puede ser cero' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._omc_validar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._omc_validar() TO postgres, service_role;

CREATE OR REPLACE FUNCTION public._operacion_validar_documento_id(v_op_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op             record;
  v_omc_count      integer;
  v_omc_sum        numeric;
  v_hija_ingreso   record;
  v_hija_trans     record;
  v_hija_apertura  record;
  v_hija_mov_prov  record;
  v_hija_mov_cli   record;
  v_omc_rec        record;
BEGIN
  SELECT id, tenant_id, taller_id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = v_op_id;

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
  IF v_op.tipo IN (
    'GASTO'::public.tipo_operacion,
    'INGRESO'::public.tipo_operacion,
    'TRANSFERENCIA'::public.tipo_operacion,
    'APERTURA_CUENTA'::public.tipo_operacion,
    'COBRO_ARREGLO'::public.tipo_operacion,
    'AJUSTE_FINANCIERO'::public.tipo_operacion,
    'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion,
    'MOVIMIENTO_CLIENTE'::public.tipo_operacion
  ) THEN
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
$$;

REVOKE ALL ON FUNCTION public._operacion_validar_documento_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._operacion_validar_documento_id(uuid) TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_movimiento_proveedor_validar_documento ON public.operaciones_movimiento_proveedor;
CREATE CONSTRAINT TRIGGER trg_movimiento_proveedor_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_movimiento_proveedor
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_movimiento_cliente_validar_documento ON public.operaciones_movimiento_cliente;
CREATE CONSTRAINT TRIGGER trg_movimiento_cliente_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_movimiento_cliente
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

-- -----------------------------------------------------------------------------
-- 4. RPCs de Creación Atómica (Proveedores y Clientes, simple o múltiples cuentas)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._insertar_movimiento_cc_tercero(
  p_tenant_id           uuid,
  p_tipo                public.tipo_operacion,
  p_tercero_id          uuid,
  p_cuenta_id           uuid,
  p_importe             numeric,
  p_fecha               timestamptz,
  p_descripcion         text,
  p_default_descripcion text,
  p_idempotency_key     uuid,
  p_observaciones       text,
  p_taller_id           uuid,
  p_created_by          uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op_id     uuid;
  v_existente uuid;
  v_monto     numeric;
BEGIN
  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id es requerido' USING ERRCODE = '22023';
  END IF;
  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, p_tenant_id, true);

  IF p_importe IS NULL OR p_importe = 0 THEN
    RAISE EXCEPTION 'El importe no puede ser cero' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':mov_cc:' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente
    FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = p_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL THEN
      RETURN v_existente;
    END IF;
  END IF;

  v_monto := ABS(p_importe);

  INSERT INTO public.operaciones (
    tenant_id, tipo, taller_id, fecha, observaciones,
    monto_total, total_pagado, esta_pago, estado_pago, estado_stock
  )
  VALUES (
    p_tenant_id,
    p_tipo,
    p_taller_id,
    COALESCE(p_fecha, now()),
    NULLIF(btrim(p_observaciones), ''),
    v_monto,
    v_monto,
    true,
    'PAGADO'::public.estado_pago_operacion,
    'NO_APLICA'::public.estado_stock_operacion
  )
  RETURNING id INTO v_op_id;

  IF p_tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_movimiento_proveedor (operacion_id, tenant_id, proveedor_id, cuenta_id)
    VALUES (v_op_id, p_tenant_id, p_tercero_id, p_cuenta_id);
  ELSIF p_tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_movimiento_cliente (operacion_id, tenant_id, cliente_id, cuenta_id)
    VALUES (v_op_id, p_tenant_id, p_tercero_id, p_cuenta_id);
  ELSE
    RAISE EXCEPTION 'Tipo inválido para movimiento directo: %', p_tipo USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, cuenta_id, importe, fecha, descripcion, idempotency_key, created_by
  )
  VALUES (
    v_op_id,
    p_tenant_id,
    p_cuenta_id,
    p_importe,
    COALESCE(p_fecha, now()),
    COALESCE(NULLIF(btrim(p_descripcion), ''), p_default_descripcion),
    p_idempotency_key,
    p_created_by
  );

  RETURN v_op_id;
END;
$$;

REVOKE ALL ON FUNCTION public._insertar_movimiento_cc_tercero(uuid, public.tipo_operacion, uuid, uuid, numeric, timestamptz, text, text, uuid, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._insertar_movimiento_cc_tercero(uuid, public.tipo_operacion, uuid, uuid, numeric, timestamptz, text, text, uuid, text, uuid, uuid)
  TO postgres, service_role;

DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_proveedor(uuid, uuid, numeric, text, timestamp with time zone, text, uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cliente(uuid, uuid, numeric, text, timestamp with time zone, text, uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_proveedor(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cliente(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb);

-- 4.1 rpc_crear_movimiento_proveedor (importe < 0: egreso/pago | importe > 0: ingreso/reintegro)
CREATE OR REPLACE FUNCTION public.rpc_crear_movimiento_proveedor(
  p_proveedor_id    uuid,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_importe         numeric                  DEFAULT NULL::numeric,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_descripcion     text                     DEFAULT NULL::text,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text,
  p_taller_id       uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_uid              uuid := auth.uid();
  v_proveedor_nombre text;
  v_op_id            uuid;
  v_first_id         uuid;
  v_item             jsonb;
  v_item_importe     numeric;
  v_default_desc     text;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF v_uid IS NOT NULL AND NOT (
    public._b2c179_tiene_permiso('operaciones:edit') OR public._b2c179_tiene_permiso('finanzas:edit')
  ) THEN
    RAISE EXCEPTION 'permiso requerido' USING ERRCODE = '42501';
  END IF;

  IF p_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'proveedor_id es requerido' USING ERRCODE = '22023';
  END IF;
  SELECT p.nombre INTO v_proveedor_nombre
  FROM public.proveedores AS p
  WHERE p.id = p_proveedor_id AND p.tenant_id = v_tenant_id;
  IF v_proveedor_nombre IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_taller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_item_importe := COALESCE((v_item ->> 'importe')::numeric, (v_item ->> 'monto')::numeric);
      v_default_desc := CASE WHEN v_item_importe < 0 THEN 'Pago a ' || v_proveedor_nombre ELSE 'Cobro de ' || v_proveedor_nombre END;

      v_op_id := public._insertar_movimiento_cc_tercero(
        v_tenant_id,
        'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion,
        p_proveedor_id,
        (v_item ->> 'cuenta_id')::uuid,
        v_item_importe,
        COALESCE((v_item ->> 'fecha')::timestamptz, p_fecha, now()),
        COALESCE(NULLIF(btrim(v_item ->> 'descripcion'), ''), p_descripcion),
        v_default_desc,
        (v_item ->> 'idempotency_key')::uuid,
        p_observaciones,
        p_taller_id,
        v_uid
      );
      IF v_first_id IS NULL THEN v_first_id := v_op_id; END IF;
    END LOOP;
    RETURN v_first_id;
  END IF;

  v_default_desc := CASE WHEN p_importe < 0 THEN 'Pago a ' || v_proveedor_nombre ELSE 'Cobro de ' || v_proveedor_nombre END;

  RETURN public._insertar_movimiento_cc_tercero(
    v_tenant_id,
    'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion,
    p_proveedor_id,
    p_cuenta_id,
    p_importe,
    p_fecha,
    p_descripcion,
    v_default_desc,
    p_idempotency_key,
    p_observaciones,
    p_taller_id,
    v_uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_proveedor(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_proveedor(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb) TO authenticated, service_role, postgres;

-- 4.2 rpc_crear_movimiento_cliente (importe > 0: ingreso/cobro | importe < 0: egreso/devolución)
CREATE OR REPLACE FUNCTION public.rpc_crear_movimiento_cliente(
  p_cliente_id      uuid,
  p_cuenta_id       uuid                     DEFAULT NULL::uuid,
  p_importe         numeric                  DEFAULT NULL::numeric,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_descripcion     text                     DEFAULT NULL::text,
  p_idempotency_key uuid                     DEFAULT NULL::uuid,
  p_observaciones   text                     DEFAULT NULL::text,
  p_taller_id       uuid                     DEFAULT NULL::uuid,
  p_pagos           jsonb                    DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id        uuid := public.current_tenant_id();
  v_uid              uuid := auth.uid();
  v_cliente_nombre   text;
  v_op_id            uuid;
  v_first_id         uuid;
  v_item             jsonb;
  v_item_importe     numeric;
  v_default_desc     text;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF v_uid IS NOT NULL AND NOT (
    public._b2c179_tiene_permiso('operaciones:edit')
    OR public._b2c179_tiene_permiso('finanzas:edit')
    OR public._b2c179_tiene_permiso('arreglos:cobros:register')
  ) THEN
    RAISE EXCEPTION 'permiso requerido' USING ERRCODE = '42501';
  END IF;

  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id es requerido' USING ERRCODE = '22023';
  END IF;

  SELECT
    CASE
      WHEN c.tipo_cliente = 'empresa' THEN emp.nombre
      WHEN c.tipo_cliente = 'particular' THEN TRIM(concat(part.nombre, ' ', COALESCE(part.apellido, '')))
      ELSE NULL
    END INTO v_cliente_nombre
  FROM public.clientes AS c
  LEFT JOIN public.empresas AS emp ON emp.id = c.id
  LEFT JOIN public.particulares AS part ON part.id = c.id
  WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant_id;

  IF v_cliente_nombre IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_taller_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.talleres WHERE id = p_taller_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Taller no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_pagos IS NOT NULL AND jsonb_typeof(p_pagos) = 'array' AND jsonb_array_length(p_pagos) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagos)
    LOOP
      v_item_importe := COALESCE((v_item ->> 'importe')::numeric, (v_item ->> 'monto')::numeric);
      v_default_desc := CASE WHEN v_item_importe > 0 THEN 'Cobro de ' || v_cliente_nombre ELSE 'Pago a ' || v_cliente_nombre END;

      v_op_id := public._insertar_movimiento_cc_tercero(
        v_tenant_id,
        'MOVIMIENTO_CLIENTE'::public.tipo_operacion,
        p_cliente_id,
        (v_item ->> 'cuenta_id')::uuid,
        v_item_importe,
        COALESCE((v_item ->> 'fecha')::timestamptz, p_fecha, now()),
        COALESCE(NULLIF(btrim(v_item ->> 'descripcion'), ''), p_descripcion),
        v_default_desc,
        (v_item ->> 'idempotency_key')::uuid,
        p_observaciones,
        p_taller_id,
        v_uid
      );
      IF v_first_id IS NULL THEN v_first_id := v_op_id; END IF;
    END LOOP;
    RETURN v_first_id;
  END IF;

  v_default_desc := CASE WHEN p_importe > 0 THEN 'Cobro de ' || v_cliente_nombre ELSE 'Pago a ' || v_cliente_nombre END;

  RETURN public._insertar_movimiento_cc_tercero(
    v_tenant_id,
    'MOVIMIENTO_CLIENTE'::public.tipo_operacion,
    p_cliente_id,
    p_cuenta_id,
    p_importe,
    p_fecha,
    p_descripcion,
    v_default_desc,
    p_idempotency_key,
    p_observaciones,
    p_taller_id,
    v_uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cliente(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cliente(uuid, uuid, numeric, timestamp with time zone, text, uuid, text, uuid, jsonb) TO authenticated, service_role, postgres;

-- -----------------------------------------------------------------------------
-- 5. Saldos y Extracto Unificado de Proveedores en SQL (sin límite PostgREST)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_proveedores_saldos(
  p_proveedor_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE (
  proveedor_id   uuid,
  total_comprado numeric,
  total_pagado   numeric,
  saldo          numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH compras AS (
    SELECT
      oc.proveedor_id,
      COALESCE(SUM(COALESCE(o.monto_total, 0)), 0)  AS total_comprado,
      COALESCE(SUM(COALESCE(o.total_pagado, 0)), 0) AS pagado_compras
    FROM public.operaciones_compra oc
    JOIN public.operaciones o ON o.id = oc.operacion_id
    WHERE oc.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'COMPRA'::public.tipo_operacion
      AND oc.proveedor_id IS NOT NULL
      AND (p_proveedor_ids IS NULL OR oc.proveedor_id = ANY(p_proveedor_ids))
    GROUP BY oc.proveedor_id
  ),
  movimientos_directos AS (
    SELECT
      omp.proveedor_id,
      -- En OMC, egreso es importe < 0 (-omc.importe es positivo = total pagado a proveedor)
      -- Ingreso es importe > 0 (-omc.importe es negativo = reduce total pagado / reintegro)
      COALESCE(SUM(-omc.importe), 0) AS total_pagado_directo
    FROM public.operaciones_movimiento_proveedor omp
    JOIN public.operaciones o ON o.id = omp.operacion_id
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE omp.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion
      AND (p_proveedor_ids IS NULL OR omp.proveedor_id = ANY(p_proveedor_ids))
    GROUP BY omp.proveedor_id
  )
  SELECT
    p.id AS proveedor_id,
    COALESCE(c.total_comprado, 0)::numeric AS total_comprado,
    (COALESCE(c.pagado_compras, 0) + COALESCE(md.total_pagado_directo, 0))::numeric AS total_pagado,
    (COALESCE(c.total_comprado, 0) - COALESCE(c.pagado_compras, 0) - COALESCE(md.total_pagado_directo, 0))::numeric AS saldo
  FROM public.proveedores p
  LEFT JOIN compras c ON c.proveedor_id = p.id
  LEFT JOIN movimientos_directos md ON md.proveedor_id = p.id
  WHERE p.tenant_id = (SELECT public.current_tenant_id())
    AND (p_proveedor_ids IS NULL OR p.id = ANY(p_proveedor_ids));
$function$;

REVOKE ALL ON FUNCTION public.rpc_proveedores_saldos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_proveedores_saldos(uuid[]) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_proveedor_cuenta_corriente(
  p_proveedor_id uuid,
  p_from         timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to           timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE (
  id              uuid,
  fecha           timestamp with time zone,
  created_at      timestamp with time zone,
  tipo_movimiento text,
  concepto        text,
  comprobante     text,
  debito          numeric,
  credito         numeric,
  operacion_id    uuid,
  cuenta_nombre   text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  WITH movimientos AS (
    -- CARGOS: Compras de mercadería al proveedor
    SELECT
      o.id                                                        AS id,
      o.fecha                                                     AS fecha,
      o.created_at                                                AS created_at,
      'CARGO_COMPRA'::text                                        AS tipo_movimiento,
      COALESCE(NULLIF(btrim(o.observaciones), ''), 'Compra #' || upper(substr(o.id::text, 1, 8))) AS concepto,
      NULL::text                                                  AS comprobante,
      COALESCE(o.monto_total, 0)::numeric                         AS debito,
      0::numeric                                                  AS credito,
      o.id                                                        AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.operaciones_compra oc
    JOIN public.operaciones o ON o.id = oc.operacion_id
    WHERE oc.tenant_id = (SELECT public.current_tenant_id())
      AND oc.proveedor_id = p_proveedor_id
      AND o.tipo = 'COMPRA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS: Pagos registrados sobre compras del proveedor
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'PAGO'::text                                                AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Pago de compra #' || upper(substr(o.id::text, 1, 8))) AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      ABS(COALESCE(omc.importe, 0))::numeric                      AS credito,
      o.id                                                        AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_compra oc ON oc.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE oc.tenant_id = (SELECT public.current_tenant_id())
      AND oc.proveedor_id = p_proveedor_id
      AND o.tipo = 'COMPRA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS / CARGOS: Movimientos directos de cuenta corriente de proveedor (PAGOS y COBROS)
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      CASE WHEN omc.importe < 0 THEN 'PAGO_DIRECTO'::text ELSE 'COBRO_DIRECTO'::text END AS tipo_movimiento,
      COALESCE(
        NULLIF(btrim(omc.descripcion), ''),
        NULLIF(btrim(o.observaciones), ''),
        CASE WHEN omc.importe < 0 THEN 'Pago a cuenta corriente' ELSE 'Cobro / reintegro de proveedor' END
      ) AS concepto,
      NULL::text                                                  AS comprobante,
      CASE WHEN omc.importe > 0 THEN ABS(omc.importe)::numeric ELSE 0::numeric END AS debito,
      CASE WHEN omc.importe < 0 THEN ABS(omc.importe)::numeric ELSE 0::numeric END AS credito,
      NULL::uuid                                                  AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_movimiento_proveedor omp ON omp.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE omp.tenant_id = (SELECT public.current_tenant_id())
      AND omp.proveedor_id = p_proveedor_id
      AND o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion
  )
  SELECT
    m.id,
    m.fecha,
    m.created_at,
    m.tipo_movimiento,
    m.concepto,
    m.comprobante,
    m.debito,
    m.credito,
    m.operacion_id,
    m.cuenta_nombre
  FROM movimientos m
  WHERE (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.rpc_proveedor_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_proveedor_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) TO authenticated, service_role, postgres;

-- 5.3 rpc_listar_movimientos_cuenta (incluye nombre del proveedor o cliente en pagos/cobros/compras/ventas)
CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta (
  p_cuenta_id uuid,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_limit     integer                  DEFAULT 100,
  p_offset    integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                   uuid,
    cuenta_financiera_id uuid,
    importe              numeric,
    fecha                timestamp with time zone,
    created_at           timestamp with time zone,
    operacion_id         uuid,
    tipo                 text,
    descripcion          text,
    categoria_gasto      text,
    arreglo_id           uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    COALESCE(o.tipo::text, 'MOVIMIENTO') AS tipo,
    CASE
      WHEN m.reversion_de_id IS NOT NULL THEN
        'Anulación — ' || COALESCE(d.base_descripcion, 'movimiento')
      ELSE
        d.base_descripcion
    END AS descripcion,
    og.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.id = m.omc_id
  LEFT JOIN public.operaciones AS o ON o.id = COALESCE(omc.operacion_id, m.operacion_id)
  LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = o.id
  LEFT JOIN public.operaciones_ingreso AS oi ON oi.operacion_id = o.id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
  LEFT JOIN public.operaciones_compra AS oc ON oc.operacion_id = o.id
  LEFT JOIN public.operaciones_movimiento_proveedor AS omp ON omp.operacion_id = o.id
  LEFT JOIN public.proveedores AS prov ON prov.id = COALESCE(oc.proveedor_id, omp.proveedor_id)
  LEFT JOIN public.operaciones_movimiento_cliente AS omc_cli ON omc_cli.operacion_id = o.id
  LEFT JOIN public.operaciones_venta AS ov ON ov.operacion_id = o.id
  LEFT JOIN public.clientes AS cli ON cli.id = COALESCE(omc_cli.cliente_id, ov.cliente_id)
  LEFT JOIN public.empresas AS cli_emp ON cli_emp.id = cli.id
  LEFT JOIN public.particulares AS cli_part ON cli_part.id = cli.id
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN cli.tipo_cliente = 'empresa' THEN cli_emp.nombre
        WHEN cli.tipo_cliente = 'particular' THEN TRIM(concat(cli_part.nombre, ' ', COALESCE(cli_part.apellido, '')))
        ELSE NULL
      END AS cliente_nombre
  ) AS c_nom
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN prov.nombre IS NOT NULL THEN
          CASE
            WHEN NULLIF(btrim(omc.descripcion), '') IS NULL THEN
              CASE
                WHEN o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion AND omc.importe < 0 THEN 'Pago a ' || prov.nombre
                WHEN o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion AND omc.importe > 0 THEN 'Cobro de ' || prov.nombre
                WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra — ' || prov.nombre
                ELSE prov.nombre
              END
            WHEN btrim(omc.descripcion) = 'Pago a cuenta de proveedor' THEN
              'Pago a ' || prov.nombre
            WHEN btrim(omc.descripcion) = 'Cobro / reintegro de proveedor' THEN
              'Cobro de ' || prov.nombre
            WHEN POSITION(lower(prov.nombre) IN lower(btrim(omc.descripcion))) > 0 THEN
              btrim(omc.descripcion)
            WHEN o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion AND omc.importe < 0 THEN
              'Pago a ' || prov.nombre || ' — ' || btrim(omc.descripcion)
            WHEN o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion AND omc.importe > 0 THEN
              'Cobro de ' || prov.nombre || ' — ' || btrim(omc.descripcion)
            ELSE
              prov.nombre || ' — ' || btrim(omc.descripcion)
          END
        WHEN c_nom.cliente_nombre IS NOT NULL AND o.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion THEN
          CASE
            WHEN NULLIF(btrim(omc.descripcion), '') IS NULL THEN
              CASE
                WHEN omc.importe > 0 THEN 'Cobro de ' || c_nom.cliente_nombre
                ELSE 'Pago a ' || c_nom.cliente_nombre
              END
            WHEN btrim(omc.descripcion) IN ('Cobro a cuenta de cliente', 'Cobro de cliente') THEN
              'Cobro de ' || c_nom.cliente_nombre
            WHEN btrim(omc.descripcion) IN ('Pago / devolución a cliente', 'Pago a cliente') THEN
              'Pago a ' || c_nom.cliente_nombre
            WHEN POSITION(lower(c_nom.cliente_nombre) IN lower(btrim(omc.descripcion))) > 0 THEN
              btrim(omc.descripcion)
            WHEN omc.importe > 0 THEN
              'Cobro de ' || c_nom.cliente_nombre || ' — ' || btrim(omc.descripcion)
            ELSE
              'Pago a ' || c_nom.cliente_nombre || ' — ' || btrim(omc.descripcion)
          END
        ELSE
          COALESCE(
            NULLIF(btrim(omc.descripcion), ''),
            NULLIF(btrim(og.descripcion), ''),
            NULLIF(btrim(oi.concepto), ''),
            CASE
              WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
              WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
              WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
              WHEN o.tipo = 'MOVIMIENTO_PROVEEDOR'::public.tipo_operacion THEN
                CASE WHEN omc.importe < 0 THEN 'Pago a proveedor' ELSE 'Cobro de proveedor' END
              WHEN o.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion THEN
                CASE WHEN omc.importe > 0 THEN 'Cobro de cliente' ELSE 'Pago a cliente' END
              WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
              WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
              ELSE NULLIF(btrim(o.observaciones), '')
            END
          )
      END AS base_descripcion
  ) AS d
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) TO authenticated, service_role, postgres;

-- -----------------------------------------------------------------------------
-- 6. Saldos Unificados y Extracto de Clientes (paridad listado <-> perfil)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_clientes_saldos(
  p_cliente_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  cliente_id uuid,
  saldo      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH arreglos_saldo AS (
    SELECT
      COALESCE(a.cliente_id, v.cliente_id) AS cliente_id,
      COALESCE(SUM(COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)), 0) AS saldo
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND a.estado != 'PRESUPUESTO'
      AND (p_cliente_ids IS NULL OR COALESCE(a.cliente_id, v.cliente_id) = ANY(p_cliente_ids))
    GROUP BY COALESCE(a.cliente_id, v.cliente_id)
  ),
  ventas_saldo AS (
    SELECT
      ov.cliente_id,
      COALESCE(SUM(COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)), 0) AS saldo
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'VENTA'::public.tipo_operacion
      AND ov.cliente_id IS NOT NULL
      AND (p_cliente_ids IS NULL OR ov.cliente_id = ANY(p_cliente_ids))
    GROUP BY ov.cliente_id
  ),
  movimientos_directos_saldo AS (
    SELECT
      omc_cli.cliente_id,
      -- En cuenta del cliente: saldo positivo = el cliente nos debe dinero.
      -- omc.importe > 0 (entra plata a caja): el cliente pagó -> reduce su deuda (-omc.importe).
      -- omc.importe < 0 (sale plata de caja): le devolvimos plata -> aumenta su saldo deudor (+ABS(omc.importe) = -omc.importe).
      -COALESCE(SUM(omc.importe), 0) AS saldo
    FROM public.operaciones_movimiento_cliente omc_cli
    JOIN public.operaciones o ON o.id = omc_cli.operacion_id
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
    WHERE omc_cli.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion
      AND (p_cliente_ids IS NULL OR omc_cli.cliente_id = ANY(p_cliente_ids))
    GROUP BY omc_cli.cliente_id
  ),
  saldos_unificados AS (
    SELECT cliente_id, saldo FROM arreglos_saldo
    UNION ALL
    SELECT cliente_id, saldo FROM ventas_saldo
    UNION ALL
    SELECT cliente_id, saldo FROM movimientos_directos_saldo
  )
  SELECT
    c.id AS cliente_id,
    COALESCE(SUM(su.saldo), 0)::numeric AS saldo
  FROM public.clientes c
  LEFT JOIN saldos_unificados su ON su.cliente_id = c.id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
    AND (p_cliente_ids IS NULL OR c.id = ANY(p_cliente_ids))
  GROUP BY c.id;
$function$;

REVOKE ALL ON FUNCTION public.rpc_clientes_saldos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_clientes_saldos(uuid[]) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_cliente_resumen_financiero(
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  v_cobros_directos            numeric := 0;
  v_pagos_directos             numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id requerido' USING ERRCODE = '22023';
  END IF;

  -- 1. Arreglos (excluyendo PRESUPUESTO)
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

  -- 2. Saldo a facturar
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

  -- 3. Ventas directas al cliente
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
    AND o.tipo = 'VENTA'::public.tipo_operacion;

  -- 4. Movimientos directos en cuenta corriente
  SELECT
    COALESCE(SUM(CASE WHEN omc.importe > 0 THEN omc.importe ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN omc.importe < 0 THEN -omc.importe ELSE 0 END), 0)
  INTO
    v_cobros_directos,
    v_pagos_directos
  FROM public.operaciones_movimiento_cliente omc_cli
  JOIN public.operaciones o ON o.id = omc_cli.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = o.id
  WHERE omc_cli.tenant_id = v_tenant_id
    AND omc_cli.cliente_id = p_cliente_id
    AND o.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion;

  v_total_historico_trabajos := v_total_historico_trabajos + v_total_ventas;
  v_total_historico_cobrado  := v_total_historico_cobrado + v_cobrado_ventas + v_cobros_directos - v_pagos_directos;
  v_cant_pendientes_pago     := v_cant_pendientes_pago + v_cant_ventas_pendientes;

  -- 5. Fuente única de verdad para saldo_cuenta (delega en rpc_clientes_saldos)
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

REVOKE ALL ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_resumen_financiero(uuid) TO authenticated, service_role, postgres;

CREATE OR REPLACE FUNCTION public.rpc_cliente_cuenta_corriente(
  p_cliente_id uuid,
  p_from       timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to         timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE (
  id              uuid,
  fecha           timestamp with time zone,
  created_at      timestamp with time zone,
  tipo_movimiento text,
  concepto        text,
  comprobante     text,
  debito          numeric,
  credito         numeric,
  arreglo_id      uuid,
  operacion_id    uuid,
  cuenta_nombre   text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  WITH movimientos AS (
    -- CARGOS: Arreglos no presupuestos
    SELECT
      a.id                                                        AS id,
      a.fecha                                                     AS fecha,
      a.created_at                                                AS created_at,
      'CARGO_ARREGLO'::text                                       AS tipo_movimiento,
      COALESCE(NULLIF(btrim(a.descripcion), ''), 'Arreglo de vehículo') || ' - ' || COALESCE(v.patente, '') AS concepto,
      (
        SELECT fe.clase_comprobante || ' ' || LPAD(fe.punto_venta::text, 4, '0') || '-' || LPAD(fe.numero_comprobante::text, 8, '0')
        FROM public.facturas_electronicas fe
        WHERE fe.arreglo_id = a.id AND fe.tenant_id = a.tenant_id AND fe.estado = 'AUTORIZADA'
        LIMIT 1
      )                                                           AS comprobante,
      COALESCE(a.precio_final, 0)::numeric                        AS debito,
      0::numeric                                                  AS credito,
      a.id                                                        AS arreglo_id,
      NULL::uuid                                                  AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id
      AND a.estado != 'PRESUPUESTO'

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre arreglos del cliente
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro registrado') || ' (' || COALESCE(v.patente, '') || ')' AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      COALESCE(omc.importe, 0)::numeric                           AS credito,
      a.id                                                        AS arreglo_id,
      oca.operacion_id                                            AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_cobro_arreglo oca
    JOIN public.arreglos a ON a.id = oca.arreglo_id
    JOIN public.operaciones o ON o.id = oca.operacion_id
    JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE oca.tenant_id = (SELECT public.current_tenant_id())
      AND COALESCE(a.cliente_id, v.cliente_id) = p_cliente_id

    UNION ALL

    -- CARGOS: Ventas de productos al cliente
    SELECT
      o.id                                                        AS id,
      o.fecha                                                     AS fecha,
      o.created_at                                                AS created_at,
      'CARGO_VENTA'::text                                         AS tipo_movimiento,
      COALESCE(NULLIF(btrim(o.observaciones), ''), 'Venta de productos #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      COALESCE(o.monto_total, 0)::numeric                         AS debito,
      0::numeric                                                  AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      NULL::text                                                  AS cuenta_nombre
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS: Cobros registrados sobre ventas del cliente
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      'COBRO'::text                                               AS tipo_movimiento,
      COALESCE(NULLIF(btrim(omc.descripcion), ''), 'Cobro de venta #' || substr(o.id::text, 1, 8)) AS concepto,
      NULL::text                                                  AS comprobante,
      0::numeric                                                  AS debito,
      ABS(COALESCE(omc.importe, 0))::numeric                      AS credito,
      NULL::uuid                                                  AS arreglo_id,
      o.id                                                        AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_venta ov ON ov.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND ov.cliente_id = p_cliente_id
      AND o.tipo = 'VENTA'::public.tipo_operacion

    UNION ALL

    -- CRÉDITOS / CARGOS: Movimientos directos a cuenta corriente de cliente (COBROS y PAGOS)
    SELECT
      omc.id                                                      AS id,
      omc.fecha                                                   AS fecha,
      omc.created_at                                              AS created_at,
      CASE WHEN omc.importe > 0 THEN 'COBRO_DIRECTO'::text ELSE 'PAGO_DIRECTO'::text END AS tipo_movimiento,
      COALESCE(
        NULLIF(btrim(omc.descripcion), ''),
        NULLIF(btrim(o.observaciones), ''),
        CASE WHEN omc.importe > 0 THEN 'Cobro a cuenta corriente' ELSE 'Pago / devolución a cliente' END
      ) AS concepto,
      NULL::text                                                  AS comprobante,
      CASE WHEN omc.importe < 0 THEN ABS(omc.importe)::numeric ELSE 0::numeric END AS debito,
      CASE WHEN omc.importe > 0 THEN ABS(omc.importe)::numeric ELSE 0::numeric END AS credito,
      NULL::uuid                                                  AS arreglo_id,
      NULL::uuid                                                  AS operacion_id,
      cf.nombre                                                   AS cuenta_nombre
    FROM public.operaciones_movimiento_cuenta omc
    JOIN public.operaciones_movimiento_cliente omc_cli ON omc_cli.operacion_id = omc.operacion_id
    JOIN public.operaciones o ON o.id = omc.operacion_id
    LEFT JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
    WHERE omc_cli.tenant_id = (SELECT public.current_tenant_id())
      AND omc_cli.cliente_id = p_cliente_id
      AND o.tipo = 'MOVIMIENTO_CLIENTE'::public.tipo_operacion
  )
  SELECT
    m.id,
    m.fecha,
    m.created_at,
    m.tipo_movimiento,
    m.concepto,
    m.comprobante,
    m.debito,
    m.credito,
    m.arreglo_id,
    m.operacion_id,
    m.cuenta_nombre
  FROM movimientos m
  WHERE (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cliente_cuenta_corriente(uuid, timestamp with time zone, timestamp with time zone) TO authenticated, service_role, postgres;

-- -----------------------------------------------------------------------------
-- 7. Limpieza de Tenant (eliminar_tenant)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.eliminar_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.tenants AS t WHERE t.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el tenant %', p_tenant_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);
  PERFORM set_config('app.stock_tenant_cleanup', 'on', true);
  PERFORM set_config('app.stock_cleanup', 'on', true);

  DELETE FROM public.empleado_salarios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_form_custom WHERE tenant_id = p_tenant_id;
  DELETE FROM public.detalle_arreglo WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_movimiento_stock WHERE tenant_id = p_tenant_id;
  DELETE FROM public.movimientos_stock WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.movimientos_financieros WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_lineas AS ol
  USING public.operaciones AS o
  WHERE ol.operacion_id = o.id AND o.tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_asignacion_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_gasto WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ingreso WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_transferencia WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_apertura_cuenta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ajuste_financiero WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_ajuste WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_venta WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_cobro_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_proveedor WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones_movimiento_cliente WHERE tenant_id = p_tenant_id;
  DELETE FROM public.operaciones WHERE tenant_id = p_tenant_id;

  DELETE FROM public.turnos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.stocks WHERE tenant_id = p_tenant_id;
  DELETE FROM public.arreglos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.empleados WHERE tenant_id = p_tenant_id;
  DELETE FROM public.vehiculos WHERE tenant_id = p_tenant_id;

  DELETE FROM public.representantes AS r
  USING public.empresas AS e, public.clientes AS c
  WHERE r.empresa_id = e.id
    AND e.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.empresas AS e
  USING public.clientes AS c
  WHERE e.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.particulares AS p
  USING public.clientes AS c
  WHERE p.id = c.id
    AND c.tenant_id = p_tenant_id;

  DELETE FROM public.clientes WHERE tenant_id = p_tenant_id;
  DELETE FROM public.productos_proveedores WHERE tenant_id = p_tenant_id;
  DELETE FROM public.proveedores WHERE tenant_id = p_tenant_id;
  DELETE FROM public.cuentas_financieras WHERE tenant_id = p_tenant_id;
  DELETE FROM public.categorias_arreglo WHERE tenant_id = p_tenant_id;
  DELETE FROM public.formularios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.talleres WHERE tenant_id = p_tenant_id;
  DELETE FROM public.productos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_members WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenants WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_tenant(uuid) TO service_role, postgres;
