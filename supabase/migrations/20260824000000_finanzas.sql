-- ============================================================================
-- MIGRACIÓN UNIFICADA DE FINANZAS, CUENTAS, MOVIMIENTOS Y GASTOS
-- B2Car - Arquitectura simplificada con Ledger Append-Only
-- ============================================================================

-- ============================================================================
-- PARTE 1: TIPOS Y MODIFICACIONES EN TABLAS EXISTENTES
-- ============================================================================

ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'MOVIMIENTO_CUENTA';
ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'GASTO';

-- Desacoplar taller_id de operaciones para soportar movimientos de cuenta
ALTER TABLE public.operaciones ALTER COLUMN taller_id DROP NOT NULL;

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_taller_requerido;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_taller_requerido
  CHECK (taller_id IS NOT NULL OR tipo::text = 'MOVIMIENTO_CUENTA');

ALTER TABLE public.operaciones DROP COLUMN IF EXISTS movimiento_financiero_id;
ALTER TABLE public.operaciones DROP COLUMN IF EXISTS evento_financiero_actual_id;

-- Limpieza de tablas obsoletas si existieran de versiones previas
DROP TABLE IF EXISTS public.eventos_financieros CASCADE;

-- ============================================================================
-- PARTE 2: TABLAS PRINCIPALES DE FINANZAS
-- ============================================================================

-- 1. Cuentas Financieras (Cajas, Bancos, Billeteras)
CREATE TABLE IF NOT EXISTS public.cuentas_financieras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  nombre           text NOT NULL,
  tipo             text NOT NULL,
  saldo            numeric(14,2) NOT NULL DEFAULT 0,
  activo           boolean NOT NULL DEFAULT true,
  idempotency_key  uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cuentas_financieras_nombre_no_vacio CHECK (nullif(btrim(nombre), '') IS NOT NULL),
  CONSTRAINT cuentas_financieras_tipo_check CHECK (
    tipo IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS cuentas_financieras_tenant_nombre_activo_key
  ON public.cuentas_financieras (tenant_id, lower(nombre))
  WHERE activo;

CREATE INDEX IF NOT EXISTS idx_cuentas_financieras_tenant_activo
  ON public.cuentas_financieras (tenant_id, activo, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS cuentas_financieras_tenant_idempotency_key
  ON public.cuentas_financieras (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS cuentas_financieras_set_updated_at ON public.cuentas_financieras;
CREATE TRIGGER cuentas_financieras_set_updated_at
  BEFORE UPDATE ON public.cuentas_financieras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Operaciones Movimiento Cuenta (Entidad de negocio para Gastos, Ingresos, Transferencias, Aperturas)
CREATE TABLE IF NOT EXISTS public.operaciones_movimiento_cuenta (
  operacion_id         uuid        PRIMARY KEY
                                   REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  subtipo              text        NOT NULL,
  cuenta_id            uuid        REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  importe              numeric(14,2),
  cuenta_origen_id     uuid        REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  cuenta_destino_id    uuid        REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  categoria_gasto      text,
  descripcion          text,
  arreglo_id           uuid        REFERENCES public.arreglos(id) ON DELETE SET NULL,
  idempotency_key      uuid,
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT omc_subtipo_check CHECK (
    subtipo IN ('GASTO', 'INGRESO', 'TRANSFERENCIA', 'APERTURA_CUENTA')
  ),
  CONSTRAINT omc_cuenta_xor CHECK (
    (subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA')
      AND cuenta_id IS NOT NULL
      AND cuenta_origen_id IS NULL AND cuenta_destino_id IS NULL
      AND importe IS NOT NULL AND importe <> 0)
    OR
    (subtipo = 'TRANSFERENCIA'
      AND cuenta_id IS NULL
      AND cuenta_origen_id IS NOT NULL AND cuenta_destino_id IS NOT NULL
      AND cuenta_origen_id <> cuenta_destino_id
      AND importe IS NOT NULL AND importe > 0)
  ),
  CONSTRAINT omc_categoria_gasto_check CHECK (
    categoria_gasto IS NULL OR categoria_gasto IN (
      'ALQUILER', 'SERVICIOS', 'SUELDOS_HONORARIOS', 'IMPUESTOS',
      'INSUMOS_REPUESTOS', 'HERRAMIENTAS_EQUIPAMIENTO', 'MANTENIMIENTO',
      'SEGUROS', 'TRANSPORTE_COMBUSTIBLE', 'MARKETING_PUBLICIDAD',
      'COMISIONES_GASTOS_BANCARIOS', 'OTROS'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS omc_tenant_idempotency_key
  ON public.operaciones_movimiento_cuenta (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_omc_cuenta ON public.operaciones_movimiento_cuenta (cuenta_id) WHERE cuenta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omc_cuenta_origen ON public.operaciones_movimiento_cuenta (cuenta_origen_id) WHERE cuenta_origen_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omc_cuenta_destino ON public.operaciones_movimiento_cuenta (cuenta_destino_id) WHERE cuenta_destino_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omc_arreglo ON public.operaciones_movimiento_cuenta (arreglo_id) WHERE arreglo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_omc_tenant ON public.operaciones_movimiento_cuenta (tenant_id);

-- 3. Movimientos Financieros (Ledger Inmutable Append-Only)
CREATE TABLE IF NOT EXISTS public.movimientos_financieros (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  cuenta_financiera_id uuid        NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  importe              numeric(14,2) NOT NULL,
  fecha                timestamptz NOT NULL DEFAULT now(),
  operacion_id         uuid        REFERENCES public.operaciones(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_cuenta_fecha ON public.movimientos_financieros (cuenta_financiera_id, fecha DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_tenant_fecha ON public.movimientos_financieros (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_operacion    ON public.movimientos_financieros (operacion_id) WHERE operacion_id IS NOT NULL;

-- 4. Vinculación en Arreglos (Cobros)
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS movimiento_financiero_id uuid
  REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL;

-- ============================================================================
-- PARTE 3: SEGURIDAD (RLS Y GRANTS EXPLICITOS)
-- ============================================================================

ALTER TABLE public.cuentas_financieras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cuentas_financieras_tenant_select ON public.cuentas_financieras;
CREATE POLICY cuentas_financieras_tenant_select ON public.cuentas_financieras
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.cuentas_financieras FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.cuentas_financieras TO authenticated;
GRANT ALL   ON TABLE public.cuentas_financieras TO service_role;

ALTER TABLE public.operaciones_movimiento_cuenta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS omc_tenant_select ON public.operaciones_movimiento_cuenta;
CREATE POLICY omc_tenant_select ON public.operaciones_movimiento_cuenta
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.operaciones_movimiento_cuenta FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.operaciones_movimiento_cuenta TO authenticated;
GRANT ALL   ON TABLE public.operaciones_movimiento_cuenta TO service_role;

ALTER TABLE public.movimientos_financieros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS movimientos_financieros_tenant_select ON public.movimientos_financieros;
CREATE POLICY movimientos_financieros_tenant_select ON public.movimientos_financieros
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

REVOKE ALL ON TABLE public.movimientos_financieros FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.movimientos_financieros TO authenticated;
GRANT ALL   ON TABLE public.movimientos_financieros TO service_role;

-- ============================================================================
-- PARTE 4: FUNCIONES INTERNAS DEL LEDGER Y TRIGGERS
-- ============================================================================

-- Inserción en ledger inmutable
CREATE OR REPLACE FUNCTION public._ledger_insertar(
  p_operacion_id uuid, p_tenant_id uuid, p_cuenta_id uuid, p_importe numeric, p_fecha timestamptz
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.movimientos_financieros (tenant_id, cuenta_financiera_id, importe, fecha, operacion_id)
  VALUES (p_tenant_id, p_cuenta_id, p_importe, COALESCE(p_fecha, now()), p_operacion_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public._ledger_insertar(uuid,uuid,uuid,numeric,timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- Shims de compatibilidad
CREATE OR REPLACE FUNCTION public._finanzas_reversar_movimiento(
  p_movimiento_id uuid, p_tenant_id uuid,
  p_fecha timestamptz DEFAULT now(), p_descripcion text DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mov record;
BEGIN
  SELECT m.tenant_id, m.cuenta_financiera_id, m.importe INTO v_mov
  FROM public.movimientos_financieros AS m
  WHERE m.id = p_movimiento_id AND m.tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento % no encontrado', p_movimiento_id USING ERRCODE = 'P0002'; END IF;
  RETURN public._ledger_insertar(NULL, v_mov.tenant_id, v_mov.cuenta_financiera_id, -v_mov.importe, COALESCE(p_fecha, now()));
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_reversar_movimiento(uuid,uuid,timestamptz,text,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._finanzas_movimiento_idempotente(
  p_tenant_id uuid, p_idempotency_key uuid, p_tipo_esperado text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_idempotency_key IS NULL THEN RETURN NULL; END IF;
  SELECT omc.operacion_id INTO v_id FROM public.operaciones_movimiento_cuenta AS omc
  WHERE omc.tenant_id = p_tenant_id AND omc.idempotency_key = p_idempotency_key FOR UPDATE;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_movimiento_idempotente(uuid,uuid,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._finanzas_insertar_movimiento(
  p_tenant_id uuid, p_tipo text, p_cuenta_id uuid, p_importe numeric,
  p_fecha timestamptz DEFAULT now(), p_descripcion text DEFAULT NULL,
  p_categoria_gasto text DEFAULT NULL, p_arreglo_id uuid DEFAULT NULL,
  p_operacion_id uuid DEFAULT NULL, p_reversa_movimiento_id uuid DEFAULT NULL,
  p_grupo_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN public._ledger_insertar(p_operacion_id, p_tenant_id, p_cuenta_id, p_importe, p_fecha);
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_insertar_movimiento(uuid,text,uuid,numeric,timestamptz,text,text,uuid,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Triggers de OMC -> Ledger
CREATE OR REPLACE FUNCTION public._omc_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fecha timestamptz;
BEGIN
  SELECT o.fecha INTO v_fecha FROM public.operaciones AS o WHERE o.id = NEW.operacion_id;
  IF NEW.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_id, NEW.importe, v_fecha);
  ELSIF NEW.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_origen_id, -NEW.importe, v_fecha);
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_destino_id,  NEW.importe, v_fecha);
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public._omc_after_insert() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._omc_after_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fecha timestamptz;
BEGIN
  SELECT o.fecha INTO v_fecha FROM public.operaciones AS o WHERE o.id = NEW.operacion_id;
  -- Reversar entradas anteriores
  IF OLD.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(OLD.operacion_id, OLD.tenant_id, OLD.cuenta_id, -OLD.importe, v_fecha);
  ELSIF OLD.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(OLD.operacion_id, OLD.tenant_id, OLD.cuenta_origen_id,  OLD.importe, v_fecha);
    PERFORM public._ledger_insertar(OLD.operacion_id, OLD.tenant_id, OLD.cuenta_destino_id, -OLD.importe, v_fecha);
  END IF;
  -- Crear nuevas entradas
  IF NEW.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_id, NEW.importe, v_fecha);
  ELSIF NEW.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_origen_id, -NEW.importe, v_fecha);
    PERFORM public._ledger_insertar(NEW.operacion_id, NEW.tenant_id, NEW.cuenta_destino_id,  NEW.importe, v_fecha);
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public._omc_after_update() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._omc_after_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.subtipo IN ('GASTO', 'INGRESO', 'APERTURA_CUENTA') THEN
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_id, -OLD.importe, now());
  ELSIF OLD.subtipo = 'TRANSFERENCIA' THEN
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_origen_id,  OLD.importe, now());
    PERFORM public._ledger_insertar(NULL, OLD.tenant_id, OLD.cuenta_destino_id, -OLD.importe, now());
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public._omc_after_delete() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS omc_after_insert ON public.operaciones_movimiento_cuenta;
DROP TRIGGER IF EXISTS omc_after_update ON public.operaciones_movimiento_cuenta;
DROP TRIGGER IF EXISTS omc_after_delete ON public.operaciones_movimiento_cuenta;
CREATE TRIGGER omc_after_insert AFTER INSERT ON public.operaciones_movimiento_cuenta FOR EACH ROW EXECUTE FUNCTION public._omc_after_insert();
CREATE TRIGGER omc_after_update AFTER UPDATE ON public.operaciones_movimiento_cuenta FOR EACH ROW EXECUTE FUNCTION public._omc_after_update();
CREATE TRIGGER omc_after_delete AFTER DELETE ON public.operaciones_movimiento_cuenta FOR EACH ROW EXECUTE FUNCTION public._omc_after_delete();

-- Triggers de movimientos_financieros
CREATE OR REPLACE FUNCTION public._finanzas_actualizar_saldo_cuenta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cuentas_financieras SET saldo = saldo + NEW.importe WHERE id = NEW.cuenta_financiera_id;
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_actualizar_saldo_cuenta() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS movimientos_financieros_actualizar_saldo ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_actualizar_saldo
  AFTER INSERT ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_actualizar_saldo_cuenta();

CREATE OR REPLACE FUNCTION public._finanzas_bloquear_mutacion_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Los movimientos del ledger son inmutables.' USING ERRCODE = '55000';
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_bloquear_mutacion_ledger() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS movimientos_financieros_bloquear_mutacion ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_bloquear_mutacion
  BEFORE UPDATE OR DELETE ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

CREATE OR REPLACE FUNCTION public._finanzas_validar_movimiento_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cuenta_tenant uuid;
BEGIN
  SELECT c.tenant_id INTO v_cuenta_tenant FROM public.cuentas_financieras AS c WHERE c.id = NEW.cuenta_financiera_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta financiera % no existe', NEW.cuenta_financiera_id USING ERRCODE = 'P0002'; END IF;
  IF v_cuenta_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cuenta financiera no pertenece al tenant' USING ERRCODE = '28000';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_validar_movimiento_tenant() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS movimientos_financieros_validar_tenant ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_validar_tenant
  BEFORE INSERT ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_movimiento_tenant();

CREATE OR REPLACE FUNCTION public._finanzas_exigir_cuenta(
  p_cuenta_id uuid, p_tenant_id uuid, p_exigir_activa boolean DEFAULT true
)
RETURNS public.cuentas_financieras LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cuenta public.cuentas_financieras;
BEGIN
  IF p_cuenta_id IS NULL THEN RAISE EXCEPTION 'cuenta_id es requerido' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_cuenta FROM public.cuentas_financieras AS c
  WHERE c.id = p_cuenta_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta financiera % no existe', p_cuenta_id USING ERRCODE = 'P0002'; END IF;
  IF p_exigir_activa AND NOT v_cuenta.activo THEN
    RAISE EXCEPTION 'La cuenta % está inactiva', v_cuenta.nombre USING ERRCODE = '22023';
  END IF;
  RETURN v_cuenta;
END; $$;
REVOKE ALL ON FUNCTION public._finanzas_exigir_cuenta(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._crear_apertura_cuenta(p_tenant_id uuid, p_cuenta_id uuid, p_saldo numeric, p_fecha timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (p_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now())) RETURNING id INTO v_op_id;
  INSERT INTO public.operaciones_movimiento_cuenta (operacion_id, tenant_id, subtipo, cuenta_id, importe, created_by)
  VALUES (v_op_id, p_tenant_id, 'APERTURA_CUENTA', p_cuenta_id, p_saldo, auth.uid());
  RETURN v_op_id;
END; $$;
REVOKE ALL ON FUNCTION public._crear_apertura_cuenta(uuid,uuid,numeric,timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================================
-- PARTE 5: RPCS DE MOVIMIENTOS DE CUENTA (GASTO, INGRESO, TRANSFERENCIA)
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid);
DROP FUNCTION IF EXISTS public.rpc_crear_movimiento_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_crear_movimiento_cuenta(
  p_subtipo text, p_importe numeric,
  p_descripcion text DEFAULT NULL, p_categoria_gasto text DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_cuenta_origen_id uuid DEFAULT NULL, p_cuenta_destino_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT now(), p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id   uuid := public.current_tenant_id();
  v_subtipo     text := upper(btrim(coalesce(p_subtipo, '')));
  v_op_id       uuid;
  v_existente   uuid;
  v_importe_omc numeric;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_subtipo NOT IN ('GASTO', 'INGRESO', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'subtipo inválido: %. Válidos: GASTO, INGRESO, TRANSFERENCIA', p_subtipo USING ERRCODE = '22023';
  END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser un valor positivo mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF v_subtipo IN ('GASTO', 'INGRESO') AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id es requerido para %', v_subtipo USING ERRCODE = '22023';
  END IF;
  IF v_subtipo = 'TRANSFERENCIA' THEN
    IF p_cuenta_origen_id IS NULL OR p_cuenta_destino_id IS NULL THEN
      RAISE EXCEPTION 'cuenta_origen_id y cuenta_destino_id son requeridos' USING ERRCODE = '22023';
    END IF;
    IF p_cuenta_origen_id = p_cuenta_destino_id THEN
      RAISE EXCEPTION 'Las cuentas de origen y destino deben ser distintas' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_subtipo = 'GASTO' AND (p_categoria_gasto IS NULL OR btrim(p_categoria_gasto) = '') THEN
    RAISE EXCEPTION 'categoria_gasto es requerida para un GASTO' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL THEN RETURN v_existente; END IF;
  END IF;

  IF v_subtipo IN ('GASTO', 'INGRESO') THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  ELSIF v_subtipo = 'TRANSFERENCIA' THEN
    IF p_cuenta_origen_id < p_cuenta_destino_id THEN
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    ELSE
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
      PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    END IF;
  END IF;

  v_importe_omc := CASE WHEN v_subtipo = 'GASTO' THEN -p_importe ELSE p_importe END;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now())) RETURNING id INTO v_op_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id, tenant_id, subtipo, cuenta_id, importe,
    cuenta_origen_id, cuenta_destino_id, categoria_gasto,
    descripcion, arreglo_id, idempotency_key, created_by
  ) VALUES (
    v_op_id, v_tenant_id, v_subtipo, p_cuenta_id, v_importe_omc,
    p_cuenta_origen_id, p_cuenta_destino_id,
    CASE WHEN v_subtipo = 'GASTO' THEN p_categoria_gasto ELSE NULL END,
    nullif(btrim(p_descripcion), ''), p_arreglo_id, p_idempotency_key, auth.uid()
  );

  RETURN v_op_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_movimiento_cuenta(text,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_actualizar_movimiento_cuenta(uuid,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid);
DROP FUNCTION IF EXISTS public.rpc_actualizar_movimiento_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_actualizar_movimiento_cuenta(
  p_operacion_id uuid, p_importe numeric DEFAULT NULL,
  p_descripcion text DEFAULT NULL, p_categoria_gasto text DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_cuenta_origen_id uuid DEFAULT NULL, p_cuenta_destino_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_omc       public.operaciones_movimiento_cuenta%ROWTYPE;
  v_existente uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT omc.operacion_id INTO v_existente FROM public.operaciones_movimiento_cuenta AS omc
    WHERE omc.tenant_id = v_tenant_id AND omc.idempotency_key = p_idempotency_key;
    IF v_existente IS NOT NULL AND v_existente <> p_operacion_id THEN RETURN v_existente; END IF;
  END IF;
  SELECT omc.* INTO v_omc FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id AND omc.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado: %', p_operacion_id USING ERRCODE = 'P0002'; END IF;
  IF p_fecha IS NOT NULL THEN
    UPDATE public.operaciones SET fecha = p_fecha WHERE id = p_operacion_id;
  END IF;
  UPDATE public.operaciones_movimiento_cuenta SET
    importe           = CASE WHEN p_importe IS NOT NULL THEN
                          CASE WHEN v_omc.subtipo = 'GASTO' THEN -abs(p_importe) ELSE abs(p_importe) END
                        ELSE importe END,
    cuenta_id         = COALESCE(p_cuenta_id, cuenta_id),
    cuenta_origen_id  = COALESCE(p_cuenta_origen_id, cuenta_origen_id),
    cuenta_destino_id = COALESCE(p_cuenta_destino_id, cuenta_destino_id),
    categoria_gasto   = CASE WHEN v_omc.subtipo = 'GASTO' THEN COALESCE(p_categoria_gasto, categoria_gasto) ELSE NULL END,
    descripcion       = COALESCE(nullif(btrim(p_descripcion), ''), descripcion),
    arreglo_id        = COALESCE(p_arreglo_id, arreglo_id),
    idempotency_key   = COALESCE(p_idempotency_key, idempotency_key)
  WHERE operacion_id = p_operacion_id;
  RETURN p_operacion_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_movimiento_cuenta(uuid,numeric,text,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_eliminar_movimiento_cuenta(uuid);
DROP FUNCTION IF EXISTS public.rpc_eliminar_movimiento_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_eliminar_movimiento_cuenta(p_operacion_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_count     int;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'p_operacion_id requerido' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.operaciones_movimiento_cuenta AS omc
  JOIN public.operaciones AS o ON o.id = omc.operacion_id
  WHERE omc.operacion_id = p_operacion_id AND omc.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.operaciones WHERE id = p_operacion_id AND tenant_id = v_tenant_id AND tipo = 'MOVIMIENTO_CUENTA';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_eliminar_movimiento_cuenta(uuid) TO authenticated, service_role;

-- ============================================================================
-- PARTE 6: RPCS DE GESTIÓN DE CUENTAS FINANCIERAS
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamptz, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_crear_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_crear_cuenta(
  p_nombre text, p_tipo text,
  p_saldo_inicial numeric DEFAULT 0, p_fecha timestamptz DEFAULT now(), p_idempotency_key uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cuenta_id uuid;
  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_tipo      text := upper(btrim(coalesce(p_tipo, '')));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'nombre no puede estar vacío' USING ERRCODE = '22023'; END IF;
  IF v_tipo NOT IN ('EFECTIVO','CUENTA_BANCARIA','BILLETERA_DIGITAL','TARJETA_CREDITO') THEN
    RAISE EXCEPTION 'tipo de cuenta inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT c.id INTO v_cuenta_id FROM public.cuentas_financieras AS c
    WHERE c.tenant_id = v_tenant_id AND c.idempotency_key = p_idempotency_key;
    IF v_cuenta_id IS NOT NULL THEN
      RETURN QUERY
      SELECT
        c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
        COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
        c.saldo AS saldo_actual,
        c.saldo AS saldo,
        c.created_at, c.updated_at
      FROM public.cuentas_financieras AS c
      LEFT JOIN public.operaciones_movimiento_cuenta AS omc
        ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
      WHERE c.id = v_cuenta_id
      GROUP BY c.id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.cuentas_financieras (tenant_id, nombre, tipo, saldo, activo, idempotency_key)
  VALUES (v_tenant_id, v_nombre, v_tipo, 0, true, p_idempotency_key)
  RETURNING cuentas_financieras.id INTO v_cuenta_id;

  IF coalesce(p_saldo_inicial, 0) <> 0 THEN
    PERFORM public._crear_apertura_cuenta(v_tenant_id, v_cuenta_id, p_saldo_inicial, COALESCE(p_fecha, now()));
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
  WHERE c.id = v_cuenta_id
  GROUP BY c.id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_crear_cuenta(text,text,numeric,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_crear_cuenta(text,text,numeric,timestamptz,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_actualizar_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_cuenta(
  p_cuenta_id uuid,
  p_nombre text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_activo boolean DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo      text;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, false);

  IF p_nombre IS NOT NULL AND nullif(btrim(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'nombre de cuenta requerido' USING ERRCODE = '22023';
  END IF;

  IF p_tipo IS NOT NULL THEN
    v_tipo := upper(btrim(p_tipo));
    IF v_tipo NOT IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO') THEN
      RAISE EXCEPTION 'tipo de cuenta inválido (%)', p_tipo USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.cuentas_financieras AS c
  SET nombre = COALESCE(nullif(btrim(p_nombre), ''), c.nombre),
      tipo   = COALESCE(v_tipo, c.tipo),
      activo = COALESCE(p_activo, c.activo)
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_eliminar_cuenta(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_eliminar_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_cuenta(p_cuenta_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, false);

  UPDATE public.cuentas_financieras
  SET activo = false
  WHERE id = p_cuenta_id
    AND tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_cuentas() CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_cuentas CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_cuentas()
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, lower(c.nombre), c.created_at;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_cuentas() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_cuenta(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_cuenta(p_cuenta_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo::text, c.activo,
    COALESCE(SUM(omc.importe), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc
    ON omc.cuenta_id = c.id AND omc.subtipo = 'APERTURA_CUENTA'
  WHERE c.id = p_cuenta_id AND c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) TO authenticated, service_role;

-- ============================================================================
-- PARTE 7: RPCS DE COBROS DE ARREGLOS
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo(uuid,uuid,timestamptz,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_cobrar_arreglo CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id uuid, p_cuenta_id uuid,
  p_fecha_cobro timestamptz DEFAULT now(), p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id     uuid := public.current_tenant_id();
  v_arreglo       record;
  v_movimiento_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    SELECT a.movimiento_financiero_id INTO v_movimiento_id FROM public.arreglos AS a
    WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.esta_pago;
    IF v_movimiento_id IS NOT NULL THEN RETURN v_movimiento_id; END IF;
  END IF;
  SELECT a.id, a.precio_final, a.esta_pago, a.tenant_id INTO v_arreglo
  FROM public.arreglos AS a WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;
  IF v_arreglo.esta_pago THEN RAISE EXCEPTION 'El arreglo ya se encuentra pago' USING ERRCODE = '55000'; END IF;
  IF coalesce(v_arreglo.precio_final, 0) <= 0 THEN
    RAISE EXCEPTION 'El arreglo no tiene precio final definido' USING ERRCODE = '22023';
  END IF;
  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  v_movimiento_id := public._ledger_insertar(NULL, v_tenant_id, p_cuenta_id, v_arreglo.precio_final, COALESCE(p_fecha_cobro, now()));
  UPDATE public.arreglos SET esta_pago = true, movimiento_financiero_id = v_movimiento_id WHERE id = p_arreglo_id;
  RETURN v_movimiento_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid,uuid,timestamptz,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_cobro_arreglo CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(p_arreglo_id uuid, p_idempotency_key uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id  uuid := public.current_tenant_id();
  v_arreglo    record;
  v_cobro      record;
  v_reversa_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  SELECT a.id, a.esta_pago, a.movimiento_financiero_id INTO v_arreglo
  FROM public.arreglos AS a WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado: %', p_arreglo_id USING ERRCODE = 'P0002'; END IF;
  IF NOT v_arreglo.esta_pago THEN RAISE EXCEPTION 'El arreglo no está marcado como pago' USING ERRCODE = '55000'; END IF;
  IF v_arreglo.movimiento_financiero_id IS NULL THEN
    RAISE EXCEPTION 'El arreglo no tiene movimiento de cobro asociado' USING ERRCODE = '22023';
  END IF;
  SELECT m.id, m.importe, m.cuenta_financiera_id INTO v_cobro
  FROM public.movimientos_financieros AS m WHERE m.id = v_arreglo.movimiento_financiero_id AND m.tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento de cobro no encontrado' USING ERRCODE = 'P0002'; END IF;
  v_reversa_id := public._ledger_insertar(NULL, v_tenant_id, v_cobro.cuenta_financiera_id, -v_cobro.importe, now());
  UPDATE public.arreglos SET esta_pago = false, movimiento_financiero_id = v_reversa_id WHERE id = p_arreglo_id;
  RETURN v_reversa_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid,uuid) TO authenticated, service_role;

-- ============================================================================
-- PARTE 8: RPCS DE OPERACIONES CON STOCK Y FINANZAS
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(text,uuid,jsonb,uuid,timestamptz,uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo text, p_taller_id uuid, p_lineas jsonb,
  p_arreglo_id uuid DEFAULT NULL, p_fecha timestamptz DEFAULT now(),
  p_cuenta_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id      uuid := public.current_tenant_id();
  v_tipo           public.tipo_operacion;
  v_operacion_id   uuid;
  v_linea          jsonb;
  v_stock_id       uuid;
  v_cantidad       int;
  v_monto_unitario numeric;
  v_delta_cantidad int;
  v_importe        numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_tipo IS NULL OR upper(p_tipo) IN ('MOVIMIENTO_CUENTA', 'GASTO') THEN
    RAISE EXCEPTION 'Use rpc_crear_movimiento_cuenta para operaciones financieras' USING ERRCODE = '22023';
  END IF;
  v_tipo := p_tipo::public.tipo_operacion;
  IF p_taller_id IS NULL THEN
    RAISE EXCEPTION 'taller_id es requerido para operaciones de stock' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, v_tipo, p_taller_id, COALESCE(p_fecha, now())) RETURNING id INTO v_operacion_id;
  IF p_arreglo_id IS NOT NULL AND v_tipo = 'ASIGNACION_ARREGLO' THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES (v_operacion_id, p_arreglo_id);
  END IF;
  FOR v_linea IN SELECT * FROM jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) LOOP
    v_stock_id       := (v_linea->>'stock_id')::uuid;
    v_cantidad       := coalesce((v_linea->>'cantidad')::int, 0);
    v_monto_unitario := coalesce((v_linea->>'monto_unitario')::numeric, 0);
    v_delta_cantidad := coalesce((v_linea->>'delta_cantidad')::int, 0);
    INSERT INTO public.operaciones_lineas (operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad)
    VALUES (v_operacion_id, v_stock_id, v_cantidad, v_monto_unitario, v_delta_cantidad);
    UPDATE public.stocks SET cantidad = cantidad + v_delta_cantidad WHERE id = v_stock_id;
    v_importe := v_importe + (v_cantidad * v_monto_unitario);
  END LOOP;
  IF p_cuenta_id IS NOT NULL AND v_importe <> 0 AND v_tipo IN ('COMPRA', 'VENTA') THEN
    PERFORM public._ledger_insertar(
      v_operacion_id, v_tenant_id, p_cuenta_id,
      CASE WHEN v_tipo = 'COMPRA' THEN -v_importe ELSE v_importe END,
      COALESCE(p_fecha, now())
    );
  END IF;
  RETURN v_operacion_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(text,uuid,jsonb,uuid,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(text,uuid,jsonb,uuid,timestamptz,uuid,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock(p_operacion_id uuid, p_idempotency_key uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion record;
  v_linea     record;
  v_mov       record;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  SELECT o.id, o.tipo INTO v_operacion FROM public.operaciones AS o
  WHERE o.id = p_operacion_id AND o.tenant_id = v_tenant_id AND o.tipo <> 'MOVIMIENTO_CUENTA' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  FOR v_linea IN SELECT l.stock_id, l.delta_cantidad FROM public.operaciones_lineas AS l WHERE l.operacion_id = p_operacion_id LOOP
    UPDATE public.stocks SET cantidad = cantidad - v_linea.delta_cantidad WHERE id = v_linea.stock_id;
  END LOOP;
  FOR v_mov IN SELECT m.cuenta_financiera_id, m.importe FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id AND m.tenant_id = v_tenant_id LOOP
    PERFORM public._ledger_insertar(NULL, v_tenant_id, v_mov.cuenta_financiera_id, -v_mov.importe, now());
  END LOOP;
  DELETE FROM public.operaciones WHERE id = p_operacion_id AND tenant_id = v_tenant_id;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid,uuid) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_actualizar_operacion_con_stock(uuid,text,uuid,jsonb,timestamptz,uuid,uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_actualizar_operacion_con_stock CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion_con_stock(
  p_operacion_id uuid, p_tipo text, p_taller_id uuid, p_lineas jsonb,
  p_fecha timestamptz DEFAULT now(), p_cuenta_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_cuenta_id uuid := p_cuenta_id;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_cuenta_id IS NULL AND p_tipo IN ('COMPRA', 'VENTA') THEN
    SELECT m.cuenta_financiera_id INTO v_cuenta_id FROM public.movimientos_financieros AS m
    WHERE m.operacion_id = p_operacion_id AND m.tenant_id = v_tenant_id LIMIT 1;
  END IF;
  PERFORM public.rpc_borrar_operacion_con_stock(p_operacion_id, NULL);
  RETURN public.rpc_crear_operacion_con_stock(p_tipo, p_taller_id, p_lineas, NULL, p_fecha, v_cuenta_id, p_idempotency_key);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid,text,uuid,jsonb,timestamptz,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid,text,uuid,jsonb,timestamptz,uuid,uuid) TO authenticated, service_role;

-- ============================================================================
-- PARTE 9: RPCS DE REPORTES, LISTADOS Y ESTADÍSTICAS
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_tipos text[] DEFAULT NULL, p_page int DEFAULT 1, p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid, tipo text, taller_id uuid, fecha timestamptz, created_at timestamptz,
  lineas jsonb, gasto_id uuid, descripcion text, categoria_gasto text,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text, monto numeric, total_count bigint
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH rows AS (
    SELECT
      o.id,
      COALESCE(omc.subtipo, o.tipo::text) AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      omc.descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre)             AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to   IS NULL OR o.fecha <  p_to)
  )
  SELECT r.*, COUNT(*) OVER() AS total_count
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT  LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz,timestamptz,text[],int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_listar_movimientos_cuenta CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta(
  p_cuenta_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, cuenta_financiera_id uuid, importe numeric, fecha timestamptz,
  created_at timestamptz, operacion_id uuid, tipo text, descripcion text, categoria_gasto text
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT m.id, m.cuenta_financiera_id, m.importe, m.fecha, m.created_at, m.operacion_id,
    COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO') AS tipo,
    omc.descripcion, omc.categoria_gasto
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = m.operacion_id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to   IS NULL OR m.fecha <  p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid,timestamptz,timestamptz,int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_movimientos CASCADE;

-- Alias de compatibilidad
CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_movimientos(
  p_cuenta_id uuid, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, cuenta_financiera_id uuid, importe numeric, fecha timestamptz,
  created_at timestamptz, operacion_id uuid, tipo text, descripcion text, categoria_gasto text
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT * FROM public.rpc_listar_movimientos_cuenta(p_cuenta_id, p_from, p_to, p_limit, p_offset);
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid,timestamptz,timestamptz,int,int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz,timestamptz,public.tipo_operacion[]) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_operaciones_stats CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_operaciones_stats(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_tipos text[] DEFAULT NULL
)
RETURNS TABLE (ventas numeric, compras numeric, asignaciones bigint, gastos numeric, neto numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH base AS (
    SELECT
      COALESCE(omc.subtipo, o.tipo::text) AS tipo,
      COALESCE(
        abs(omc.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      ) AS monto
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to   IS NULL OR o.fecha <  p_to)
      AND (COALESCE(cardinality(p_tipos), 0) = 0 OR COALESCE(omc.subtipo, o.tipo::text) = ANY(p_tipos))
  )
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'VENTA'   THEN monto ELSE 0 END), 0) AS ventas,
    COALESCE(SUM(CASE WHEN tipo = 'COMPRA'  THEN monto ELSE 0 END), 0) AS compras,
    COALESCE(COUNT(CASE WHEN tipo = 'ASIGNACION_ARREGLO' THEN 1 END), 0) AS asignaciones,
    COALESCE(SUM(CASE WHEN tipo = 'GASTO'   THEN monto ELSE 0 END), 0) AS gastos,
    COALESCE(SUM(CASE WHEN tipo = 'VENTA'   THEN  monto
                      WHEN tipo = 'COMPRA'  THEN -monto
                      WHEN tipo = 'GASTO'   THEN -monto
                      WHEN tipo = 'INGRESO' THEN  monto
                      ELSE 0 END), 0) AS neto
  FROM base;
$$;

REVOKE ALL ON FUNCTION public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz,timestamptz,text[]) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo CASCADE;

CREATE OR REPLACE FUNCTION public.dashboard_gastos_por_periodo(
  p_from timestamptz, p_to timestamptz, p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, repuestos numeric, sueldos numeric, eventuales numeric)
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'), b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', p_from),
      date_trunc('month', p_to - interval '1 second'), interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start, COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE e.tenant_id = (SELECT public.current_tenant_id())
          AND (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(abs(omc.importe)), 0)::numeric AS eventual
    FROM public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id
    WHERE omc.subtipo = 'GASTO'
      AND omc.tenant_id = (SELECT public.current_tenant_id())
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id OR o.taller_id IS NULL)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         COALESCE(c.rep, 0), COALESCE(sm.sueldos, 0), COALESCE(ge.eventual, 0)
  FROM slots AS s
  LEFT JOIN compras AS c USING (slot_start)
  LEFT JOIN sueldo_mes AS sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  LEFT JOIN gastos_eventuales AS ge USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- ============================================================================
-- PARTE 10: DROPS DE RPCS OBSOLETOS DE VERSIONES ANTERIORES
-- ============================================================================

DROP FUNCTION IF EXISTS public.rpc_finanzas_registrar_gasto CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_actualizar_gasto CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_eliminar_gasto CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_transferir CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_anular_transferencia CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_gastos CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_gasto CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_resumen_global CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_kpis CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_recalcular_saldos CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_health_check CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_reconciliar_cuentas CASCADE;
DROP FUNCTION IF EXISTS public.rpc_finanzas_auditar_ledger CASCADE;
