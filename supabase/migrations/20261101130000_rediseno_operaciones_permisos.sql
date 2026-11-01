-- ============================================================================
-- Migración D: Cierre de esquema, invariantes diferidas y permisos de seguridad
-- Rediseño de Operaciones y Ledgers
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Invariante: Bloqueo de tipo MOVIMIENTO_CUENTA en public.operaciones
-- -----------------------------------------------------------------------------

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_tipo_no_movimiento_cuenta;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_tipo_no_movimiento_cuenta
  CHECK (tipo::text <> 'MOVIMIENTO_CUENTA');

-- -----------------------------------------------------------------------------
-- 2. Constraint Trigger Diferido: Validación de documento y coherencia completa
-- -----------------------------------------------------------------------------

-- Eliminar triggers anteriores de operaciones instantáneas
DROP TRIGGER IF EXISTS trg_operacion_validar_instantanea ON public.operaciones;
DROP TRIGGER IF EXISTS trg_omc_validar_instantanea ON public.operaciones_movimiento_cuenta;
DROP TRIGGER IF EXISTS trg_ingreso_validar_instantanea ON public.operaciones_ingreso;
DROP TRIGGER IF EXISTS trg_transferencia_validar_instantanea ON public.operaciones_transferencia;
DROP TRIGGER IF EXISTS trg_apertura_validar_instantanea ON public.operaciones_apertura_cuenta;
DROP TRIGGER IF EXISTS trg_cobro_arreglo_validar_instantanea ON public.operaciones_cobro_arreglo;
DROP FUNCTION IF EXISTS public._operacion_validar_instantanea();

CREATE OR REPLACE FUNCTION public._operacion_validar_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op_id uuid;
  v_op record;
  v_omc_count integer;
  v_omc_sum numeric;
  v_hija_ingreso record;
  v_hija_trans record;
  v_hija_apertura record;
  v_omc_rec record;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    IF TG_OP = 'DELETE' THEN
      v_op_id := OLD.id;
    ELSE
      v_op_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_op_id := OLD.operacion_id;
    ELSE
      v_op_id := NEW.operacion_id;
    END IF;
  END IF;

  IF v_op_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, tipo, monto_total INTO v_op
  FROM public.operaciones
  WHERE id = v_op_id;

  -- Si la operación fue eliminada en cascada en la misma transacción, finalizar
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 1. Operaciones que NO admiten líneas de mercadería
  IF v_op.tipo IN ('GASTO'::public.tipo_operacion,
                   'INGRESO'::public.tipo_operacion,
                   'TRANSFERENCIA'::public.tipo_operacion,
                   'APERTURA_CUENTA'::public.tipo_operacion,
                   'COBRO_ARREGLO'::public.tipo_operacion) THEN
    IF EXISTS (SELECT 1 FROM public.operaciones_lineas WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación % de tipo % no puede tener líneas de mercadería', v_op_id, v_op.tipo USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 2. Presencia obligatoria de la tabla hija según el tipo de operación
  IF v_op.tipo = 'COMPRA'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_compra WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación COMPRA % debe tener su registro en operaciones_compra', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'VENTA'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_venta WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación VENTA % debe tener su registro en operaciones_venta', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'GASTO'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_gasto WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación GASTO % debe tener su registro en operaciones_gasto', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación ASIGNACION_ARREGLO % debe tener su registro en operaciones_asignacion_arreglo', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'AJUSTE'::public.tipo_operacion THEN
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_ajuste WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación AJUSTE % debe tener su registro en operaciones_ajuste', v_op_id USING ERRCODE = '22023';
    END IF;

  ELSIF v_op.tipo = 'INGRESO'::public.tipo_operacion THEN
    SELECT * INTO v_hija_ingreso FROM public.operaciones_ingreso WHERE operacion_id = v_op_id;
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
    SELECT * INTO v_hija_apertura FROM public.operaciones_apertura_cuenta WHERE operacion_id = v_op_id;
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

  ELSIF v_op.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN
    SELECT * INTO v_hija_trans FROM public.operaciones_transferencia WHERE operacion_id = v_op_id;
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
    IF NOT EXISTS (SELECT 1 FROM public.operaciones_cobro_arreglo WHERE operacion_id = v_op_id) THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener su registro en operaciones_cobro_arreglo', v_op_id USING ERRCODE = '22023';
    END IF;
    SELECT count(*), COALESCE(SUM(importe), 0) INTO v_omc_count, v_omc_sum
    FROM public.operaciones_movimiento_cuenta WHERE operacion_id = v_op_id;
    IF v_omc_count <> 1 OR v_omc_sum <> v_op.monto_total THEN
      RAISE EXCEPTION 'Operación COBRO_ARREGLO % debe tener exactamente 1 OMC por el monto total', v_op_id USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Triggers diferidos en operaciones, líneas, OMC y todas las tablas hijas
DROP TRIGGER IF EXISTS trg_operacion_validar_documento ON public.operaciones;
CREATE CONSTRAINT TRIGGER trg_operacion_validar_documento
  AFTER INSERT OR UPDATE ON public.operaciones
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_lineas_validar_documento ON public.operaciones_lineas;
CREATE CONSTRAINT TRIGGER trg_lineas_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_lineas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_omc_validar_documento ON public.operaciones_movimiento_cuenta;
CREATE CONSTRAINT TRIGGER trg_omc_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_movimiento_cuenta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_compra_validar_documento ON public.operaciones_compra;
CREATE CONSTRAINT TRIGGER trg_compra_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_compra
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_venta_validar_documento ON public.operaciones_venta;
CREATE CONSTRAINT TRIGGER trg_venta_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_venta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_gasto_validar_documento ON public.operaciones_gasto;
CREATE CONSTRAINT TRIGGER trg_gasto_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_gasto
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_asig_validar_documento ON public.operaciones_asignacion_arreglo;
CREATE CONSTRAINT TRIGGER trg_asig_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_asignacion_arreglo
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_ajuste_validar_documento ON public.operaciones_ajuste;
CREATE CONSTRAINT TRIGGER trg_ajuste_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_ajuste
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_ingreso_validar_documento ON public.operaciones_ingreso;
CREATE CONSTRAINT TRIGGER trg_ingreso_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_ingreso
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_transferencia_validar_documento ON public.operaciones_transferencia;
CREATE CONSTRAINT TRIGGER trg_transferencia_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_transferencia
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_apertura_validar_documento ON public.operaciones_apertura_cuenta;
CREATE CONSTRAINT TRIGGER trg_apertura_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_apertura_cuenta
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

DROP TRIGGER IF EXISTS trg_cobro_arreglo_validar_documento ON public.operaciones_cobro_arreglo;
CREATE CONSTRAINT TRIGGER trg_cobro_arreglo_validar_documento
  AFTER INSERT OR UPDATE OR DELETE ON public.operaciones_cobro_arreglo
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._operacion_validar_documento();

-- -----------------------------------------------------------------------------
-- 3. Funciones SECURITY DEFINER y limpieza de funciones obsoletas
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.rpc_borrar_operaciones_con_stock_lista(uuid[]) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public._crear_producto_y_stock(uuid, text, text, numeric, numeric) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb, uuid) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb) SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb, uuid, uuid) SECURITY DEFINER SET search_path = '';

DROP FUNCTION IF EXISTS public.rpc_revertir_operacion_linea(uuid);
DROP FUNCTION IF EXISTS public.rpc_revertir_operacion_linea(uuid, uuid);

-- -----------------------------------------------------------------------------
-- 4. Revocación de permisos de mutación directa a anon y authenticated
-- -----------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  public.operaciones,
  public.operaciones_compra,
  public.operaciones_venta,
  public.operaciones_gasto,
  public.operaciones_asignacion_arreglo,
  public.operaciones_cobro_arreglo,
  public.operaciones_ajuste,
  public.operaciones_ingreso,
  public.operaciones_transferencia,
  public.operaciones_apertura_cuenta,
  public.operaciones_lineas,
  public.operaciones_movimiento_cuenta,
  public.operaciones_movimiento_stock,
  public.movimientos_financieros,
  public.movimientos_stock
FROM "anon", "authenticated";

GRANT SELECT ON TABLE
  public.operaciones,
  public.operaciones_compra,
  public.operaciones_venta,
  public.operaciones_gasto,
  public.operaciones_asignacion_arreglo,
  public.operaciones_cobro_arreglo,
  public.operaciones_ajuste,
  public.operaciones_ingreso,
  public.operaciones_transferencia,
  public.operaciones_apertura_cuenta,
  public.operaciones_lineas,
  public.operaciones_movimiento_cuenta,
  public.operaciones_movimiento_stock,
  public.movimientos_financieros,
  public.movimientos_stock
TO "anon", "authenticated";

GRANT ALL ON TABLE
  public.operaciones,
  public.operaciones_compra,
  public.operaciones_venta,
  public.operaciones_gasto,
  public.operaciones_asignacion_arreglo,
  public.operaciones_cobro_arreglo,
  public.operaciones_ajuste,
  public.operaciones_ingreso,
  public.operaciones_transferencia,
  public.operaciones_apertura_cuenta,
  public.operaciones_lineas,
  public.operaciones_movimiento_cuenta,
  public.operaciones_movimiento_stock,
  public.movimientos_financieros,
  public.movimientos_stock
TO "service_role", "postgres";

