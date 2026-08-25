-- Cuenta favorita para cobros y borrado coherente de operaciones financieras.

ALTER TABLE public.cuentas_financieras
  ADD COLUMN IF NOT EXISTS favorita boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cuentas_financieras_favorita_activa_check'
      AND conrelid = 'public.cuentas_financieras'::regclass
  ) THEN
    ALTER TABLE public.cuentas_financieras
      ADD CONSTRAINT cuentas_financieras_favorita_activa_check
      CHECK (NOT favorita OR activo);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS cuentas_financieras_tenant_favorita_key
  ON public.cuentas_financieras (tenant_id)
  WHERE favorita;

DROP FUNCTION IF EXISTS public.rpc_finanzas_actualizar_cuenta(uuid,text,text,boolean);
DROP FUNCTION IF EXISTS public.rpc_finanzas_actualizar_cuenta(uuid,text,text,boolean,boolean);

CREATE FUNCTION public.rpc_finanzas_actualizar_cuenta(
  p_cuenta_id uuid,
  p_nombre text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_favorita boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_activa_actual boolean;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT c.activo
  INTO v_activa_actual
  FROM public.cuentas_financieras AS c
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta financiera no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF p_nombre IS NOT NULL AND NULLIF(btrim(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'nombre de cuenta requerido' USING ERRCODE = '22023';
  END IF;

  IF p_tipo IS NOT NULL THEN
    v_tipo := upper(btrim(p_tipo));
    IF v_tipo NOT IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO') THEN
      RAISE EXCEPTION 'tipo de cuenta invalido (%)', p_tipo USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_favorita = true AND NOT COALESCE(p_activo, v_activa_actual) THEN
    RAISE EXCEPTION 'Solo una cuenta activa puede ser favorita' USING ERRCODE = '22023';
  END IF;

  IF p_favorita = true THEN
    UPDATE public.cuentas_financieras AS c
    SET favorita = false
    WHERE c.tenant_id = v_tenant_id
      AND c.id <> p_cuenta_id
      AND c.favorita;
  END IF;

  UPDATE public.cuentas_financieras AS c
  SET nombre = COALESCE(NULLIF(btrim(p_nombre), ''), c.nombre),
      tipo = COALESCE(v_tipo, c.tipo),
      activo = COALESCE(p_activo, c.activo),
      favorita = CASE
        WHEN p_activo = false THEN false
        ELSE COALESCE(p_favorita, c.favorita)
      END
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid,text,text,boolean,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_cuenta(p_cuenta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, false);

  UPDATE public.cuentas_financieras
  SET activo = false,
      favorita = false
  WHERE id = p_cuenta_id
    AND tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_cuentas();

CREATE FUNCTION public.rpc_finanzas_listar_cuentas()
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean, favorita boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo, c.favorita,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, c.favorita DESC, lower(c.nombre), c.created_at;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_cuentas() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_cuenta(uuid);

CREATE FUNCTION public.rpc_finanzas_obtener_cuenta(p_cuenta_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean, favorita boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo, c.favorita,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) TO authenticated, service_role;

-- El ledger es inmutable, pero operaciones tiene una FK ON DELETE SET NULL
-- desde movimientos_financieros. Los borrados autorizados habilitan solamente
-- durante esa sentencia el modo interno que permite limpiar ese vínculo; el
-- trigger de operaciones_movimiento_cuenta inserta luego el reverso contable.
CREATE OR REPLACE FUNCTION public.rpc_eliminar_movimiento_cuenta(p_operacion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_count int;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id
    AND omc.tenant_id = v_tenant_id
  FOR UPDATE OF o, omc;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  DELETE FROM public.operaciones
  WHERE id = p_operacion_id
    AND tenant_id = v_tenant_id
    AND tipo = 'MOVIMIENTO_CUENTA';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );

  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(
  p_arreglo_id uuid,
  p_operacion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_op_id uuid := p_operacion_id;
  v_importe_anulado numeric;
  v_nuevo_total numeric;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM 1
  FROM public.arreglos
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_op_id IS NULL THEN
    SELECT oca.operacion_id
    INTO v_op_id
    FROM public.operaciones_cobro_arreglo AS oca
    WHERE oca.arreglo_id = p_arreglo_id
      AND oca.tenant_id = v_tenant_id
    ORDER BY oca.created_at DESC
    LIMIT 1;
  END IF;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron cobros para este arreglo' USING ERRCODE = 'P0002';
  END IF;

  SELECT omc.importe
  INTO v_importe_anulado
  FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones_cobro_arreglo AS oca
    ON oca.operacion_id = omc.operacion_id
  WHERE omc.operacion_id = v_op_id
    AND omc.tenant_id = v_tenant_id
    AND oca.arreglo_id = p_arreglo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobro no encontrado para este arreglo' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  DELETE FROM public.operaciones
  WHERE id = v_op_id
    AND tenant_id = v_tenant_id
    AND tipo = 'MOVIMIENTO_CUENTA';

  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );

  SELECT COALESCE(SUM(omc.importe), 0)
  INTO v_nuevo_total
  FROM public.operaciones_cobro_arreglo AS oca
  JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.operacion_id = oca.operacion_id
  WHERE oca.arreglo_id = p_arreglo_id
    AND oca.tenant_id = v_tenant_id;

  UPDATE public.arreglos
  SET total_cobrado = v_nuevo_total
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'anulada_operacion_id', v_op_id,
    'importe_anulado', v_importe_anulado,
    'total_cobrado', v_nuevo_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) TO authenticated, service_role;

-- Dispatcher de borrado: los cobros actualizan primero el estado del arreglo;
-- los demas movimientos financieros y las operaciones de stock conservan sus
-- reversos especializados.
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_completa(uuid,uuid);

CREATE FUNCTION public.rpc_borrar_operacion_completa(
  p_operacion_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo public.tipo_operacion;
  v_arreglo_id uuid;
  v_eliminada boolean;
  v_resultado jsonb;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_tenant_id::text || ':borrar-operacion:' || p_idempotency_key::text)
    );
  END IF;

  SELECT o.tipo, oca.arreglo_id
  INTO v_tipo, v_arreglo_id
  FROM public.operaciones AS o
  LEFT JOIN public.operaciones_cobro_arreglo AS oca
    ON oca.operacion_id = o.id
   AND oca.tenant_id = v_tenant_id
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_arreglo_id IS NOT NULL THEN
    v_resultado := public.rpc_finanzas_anular_cobro_arreglo(
      v_arreglo_id,
      p_operacion_id
    );

    RETURN jsonb_build_object(
      'eliminada', true,
      'tipo', 'COBRO_ARREGLO',
      'arreglo_id', v_arreglo_id,
      'resultado_cobro', v_resultado
    );
  END IF;

  IF v_tipo = 'MOVIMIENTO_CUENTA' THEN
    v_eliminada := public.rpc_eliminar_movimiento_cuenta(p_operacion_id);
  ELSE
    v_eliminada := public.rpc_borrar_operacion_con_stock(
      p_operacion_id,
      p_idempotency_key
    );
  END IF;

  IF NOT COALESCE(v_eliminada, false) THEN
    RAISE EXCEPTION 'Operacion no encontrada' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'eliminada', true,
    'tipo', v_tipo::text,
    'arreglo_id', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_completa(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_completa(uuid,uuid) TO authenticated, service_role;

-- Al borrar el arreglo no es necesario recalcular su estado entre cobros. Se
-- eliminan todas las operaciones asociadas en un solo paso y cada trigger de
-- movimiento revierte el saldo de su cuenta dentro de la misma transaccion.
CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_asignacion record;
  v_cleanup_previo text := current_setting('app.finanzas_tenant_cleanup', true);
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  PERFORM 1
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  DELETE FROM public.operaciones AS o
  USING public.operaciones_cobro_arreglo AS oca
  WHERE o.id = oca.operacion_id
    AND o.tenant_id = v_tenant_id
    AND oca.tenant_id = v_tenant_id
    AND oca.arreglo_id = p_arreglo_id
    AND o.tipo = 'MOVIMIENTO_CUENTA';

  PERFORM set_config(
    'app.finanzas_tenant_cleanup',
    COALESCE(NULLIF(v_cleanup_previo, ''), 'off'),
    true
  );

  FOR v_asignacion IN
    SELECT oa.operacion_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
      AND o.tenant_id = v_tenant_id
  LOOP
    PERFORM public.rpc_borrar_operacion_con_stock(
      v_asignacion.operacion_id,
      NULL
    );
  END LOOP;

  DELETE FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_arreglo(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
