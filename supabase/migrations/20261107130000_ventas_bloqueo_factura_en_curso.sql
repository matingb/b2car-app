-- =============================================================================
-- Ventas: mismo bloqueo fiscal que los arreglos
-- =============================================================================
-- Un arreglo queda bloqueado mientras su factura está AUTORIZADA, ENVIANDO o
-- INCIERTA (facturacion_bloquear_mutacion_arreglo). Las ventas sólo se
-- bloqueaban con AUTORIZADA, así que durante una emisión en curso o incierta se
-- podían editar, y una reconciliación posterior podía autorizar un comprobante
-- que ya no coincidía con la venta.
--
-- facturacion_operacion_bloqueada reemplaza a facturacion_operacion_autorizada,
-- que sólo usaban el trigger de ventas y estas dos RPCs. Una factura RECHAZADA
-- no bloquea: la venta se puede corregir y reintentar. Los cambios operativos
-- (pagos, entregas) siguen permitidos como hasta ahora.
-- Test: supabase/tests/ventas_bloqueo_factura_en_curso.sql

CREATE FUNCTION public.facturacion_operacion_bloqueada (
  p_operacion_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT EXISTS (SELECT 1 FROM public.facturas_electronicas f
    WHERE f.operacion_id = p_operacion_id AND f.estado IN ('AUTORIZADA', 'ENVIANDO', 'INCIERTA'));
$function$;

REVOKE ALL ON FUNCTION public.facturacion_operacion_bloqueada(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.facturacion_operacion_bloqueada(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- facturacion_bloquear_mutacion_operacion_facturada: usa facturacion_operacion_bloqueada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_operacion_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_operacion_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_operacion_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
  END IF;

  IF public.facturacion_operacion_bloqueada(v_operacion_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'No se puede eliminar una venta con comprobante fiscal autorizado o en emisión';
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se pueden agregar líneas a una venta con comprobante fiscal autorizado o en emisión';
    ELSIF TG_OP = 'UPDATE' THEN
      IF TG_TABLE_NAME = 'operaciones' THEN
        IF NEW.tipo IS DISTINCT FROM OLD.tipo
           OR NEW.fecha IS DISTINCT FROM OLD.fecha
           OR NEW.taller_id IS DISTINCT FROM OLD.taller_id
           OR NEW.monto_total IS DISTINCT FROM OLD.monto_total
           OR NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
          RAISE EXCEPTION 'No se pueden modificar datos fiscales de una venta con comprobante fiscal autorizado o en emisión';
        END IF;
      ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
        IF NEW.stock_id IS DISTINCT FROM OLD.stock_id
           OR NEW.operacion_id IS DISTINCT FROM OLD.operacion_id
           OR NEW.sentido IS DISTINCT FROM OLD.sentido
           OR NEW.cantidad IS DISTINCT FROM OLD.cantidad
           OR NEW.monto_unitario IS DISTINCT FROM OLD.monto_unitario
           OR NEW.iva_alicuota_id IS DISTINCT FROM OLD.iva_alicuota_id THEN
          RAISE EXCEPTION 'No se pueden modificar líneas de una venta con comprobante fiscal autorizado o en emisión';
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;


-- -----------------------------------------------------------------------------
-- rpc_actualizar_operacion: usa facturacion_operacion_bloqueada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion (
  p_operacion_id  uuid,
  p_fecha         timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_observaciones text                     DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, fecha, observaciones
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_bloqueada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado o en emisión';
  END IF;

  UPDATE public.operaciones
  SET fecha = COALESCE(p_fecha, fecha),
      observaciones = CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE observaciones END
  WHERE id = p_operacion_id;

  -- En los tipos instantáneos actualiza también la fecha de sus OMC
  IF p_fecha IS NOT NULL AND v_op.tipo IN ('TRANSFERENCIA', 'INGRESO', 'APERTURA_CUENTA', 'COBRO_ARREGLO') THEN
    UPDATE public.operaciones_movimiento_cuenta
    SET fecha = p_fecha
    WHERE operacion_id = p_operacion_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_operacion_id,
    'fecha', COALESCE(p_fecha, v_op.fecha),
    'observaciones', CASE WHEN p_observaciones IS NOT NULL THEN p_observaciones ELSE v_op.observaciones END
  );
END;
$function$;


-- -----------------------------------------------------------------------------
-- rpc_borrar_operacion_con_stock: usa facturacion_operacion_bloqueada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock (
  p_operacion_id uuid,
  p_unused       uuid DEFAULT NULL::uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op        record;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public._b2c179_tiene_permiso('operaciones:edit') THEN
    RAISE EXCEPTION 'permiso operaciones:edit requerido' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT id, tipo, taller_id
  INTO v_op
  FROM public.operaciones
  WHERE id = p_operacion_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada: %', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  IF public.facturacion_operacion_bloqueada(p_operacion_id) THEN
    RAISE EXCEPTION 'No se puede modificar una venta con comprobante fiscal autorizado o en emisión';
  END IF;

  -- Al borrar la operación:
  -- - La cascada borra hijas, líneas, OMS y OMC.
  -- - Los triggers de OMS generan reversas en kardex y recalculan stock.
  -- - Los triggers de OMC generan contraasientos en el ledger financiero.
  DELETE FROM public.operaciones
  WHERE id = p_operacion_id;

  RETURN true;
END;
$function$;


DROP FUNCTION public.facturacion_operacion_autorizada(uuid);
