-- B2C-132 / B2C-139: libro mayor financiero por tenant.
-- Los saldos se derivan siempre de movimientos_financieros: no hay un saldo
-- mutable que pueda quedar desincronizado con el historial.

ALTER TYPE public.tipo_operacion ADD VALUE IF NOT EXISTS 'GASTO';

-- ===========================================================================
-- Cuentas y libro mayor inmutable
-- ===========================================================================

CREATE TABLE public.cuentas_financieras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  tipo text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cuentas_financieras_nombre_no_vacio CHECK (nullif(btrim(nombre), '') IS NOT NULL),
  CONSTRAINT cuentas_financieras_tipo_check CHECK (
    tipo IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO')
  )
);

CREATE UNIQUE INDEX cuentas_financieras_tenant_nombre_activo_key
  ON public.cuentas_financieras (tenant_id, lower(nombre))
  WHERE activo;

CREATE INDEX idx_cuentas_financieras_tenant_activo
  ON public.cuentas_financieras (tenant_id, activo, created_at DESC);

CREATE TRIGGER cuentas_financieras_set_updated_at
  BEFORE UPDATE ON public.cuentas_financieras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.eventos_financieros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  descripcion text,
  cuenta_financiera_id uuid REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  arreglo_id uuid REFERENCES public.arreglos(id) ON DELETE SET NULL,
  operacion_id uuid REFERENCES public.operaciones(id) ON DELETE SET NULL,
  reversa_evento_id uuid REFERENCES public.eventos_financieros(id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eventos_financieros_tipo_check CHECK (
    tipo IN (
      'APERTURA_CUENTA',
      'TRANSFERENCIA',
      'GASTO',
      'COBRO_ARREGLO',
      'COMPRA_STOCK',
      'VENTA_STOCK',
      'REVERSO'
    )
  ),
  CONSTRAINT eventos_financieros_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX eventos_financieros_tenant_idempotency_key
  ON public.eventos_financieros (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX eventos_financieros_una_reversa_por_evento
  ON public.eventos_financieros (reversa_evento_id)
  WHERE reversa_evento_id IS NOT NULL;

CREATE INDEX idx_eventos_financieros_tenant_fecha
  ON public.eventos_financieros (tenant_id, fecha DESC, created_at DESC, id DESC);
CREATE INDEX idx_eventos_financieros_operacion ON public.eventos_financieros (operacion_id)
  WHERE operacion_id IS NOT NULL;
CREATE INDEX idx_eventos_financieros_arreglo ON public.eventos_financieros (arreglo_id)
  WHERE arreglo_id IS NOT NULL;

CREATE TABLE public.movimientos_financieros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  evento_id uuid NOT NULL REFERENCES public.eventos_financieros(id) ON DELETE RESTRICT,
  cuenta_financiera_id uuid NOT NULL REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  importe numeric(14,2) NOT NULL,
  categoria_gasto text,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_financieros_importe_no_cero CHECK (importe <> 0),
  CONSTRAINT movimientos_financieros_categoria_gasto_check CHECK (
    categoria_gasto IS NULL OR categoria_gasto IN (
      'ALQUILER',
      'SERVICIOS',
      'SUELDOS_HONORARIOS',
      'IMPUESTOS',
      'INSUMOS_REPUESTOS',
      'HERRAMIENTAS_EQUIPAMIENTO',
      'MANTENIMIENTO',
      'SEGUROS',
      'TRANSPORTE_COMBUSTIBLE',
      'MARKETING_PUBLICIDAD',
      'COMISIONES_GASTOS_BANCARIOS',
      'OTROS'
    )
  ),
  CONSTRAINT movimientos_financieros_evento_cuenta_key UNIQUE (evento_id, cuenta_financiera_id)
);

CREATE INDEX idx_movimientos_financieros_cuenta_fecha
  ON public.movimientos_financieros (cuenta_financiera_id, created_at DESC, id DESC);
CREATE INDEX idx_movimientos_financieros_evento ON public.movimientos_financieros (evento_id);
CREATE INDEX idx_movimientos_financieros_tenant_categoria
  ON public.movimientos_financieros (tenant_id, categoria_gasto)
  WHERE categoria_gasto IS NOT NULL;

-- Hooks de la entidad operativa al último evento financiero que la afectó.
ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS evento_financiero_actual_id uuid
    REFERENCES public.eventos_financieros(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS evento_financiero_actual_id uuid
    REFERENCES public.eventos_financieros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_arreglos_evento_financiero_actual
  ON public.arreglos (evento_financiero_actual_id)
  WHERE evento_financiero_actual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operaciones_evento_financiero_actual
  ON public.operaciones (evento_financiero_actual_id)
  WHERE evento_financiero_actual_id IS NOT NULL;

-- Las tablas quedan expuestas solamente para lectura. Las mutaciones pasan por
-- RPCs SECURITY DEFINER que validan el tenant y escriben evento + movimientos
-- en la misma transacción.
ALTER TABLE public.cuentas_financieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_financieros ENABLE ROW LEVEL SECURITY;

CREATE POLICY cuentas_financieras_tenant_select ON public.cuentas_financieras
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY eventos_financieros_tenant_select ON public.eventos_financieros
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY movimientos_financieros_tenant_select ON public.movimientos_financieros
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.current_tenant_id()));

REVOKE ALL ON TABLE public.cuentas_financieras, public.eventos_financieros, public.movimientos_financieros FROM PUBLIC;
REVOKE ALL ON TABLE public.cuentas_financieras, public.eventos_financieros, public.movimientos_financieros FROM anon;
GRANT SELECT ON TABLE public.cuentas_financieras, public.eventos_financieros, public.movimientos_financieros TO authenticated;
GRANT SELECT ON TABLE public.cuentas_financieras, public.eventos_financieros, public.movimientos_financieros TO service_role;

-- Defensa adicional: todo FK del libro debe pertenecer al mismo tenant.
CREATE OR REPLACE FUNCTION public._finanzas_validar_evento_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.cuenta_financiera_id IS NOT NULL THEN
    SELECT c.tenant_id INTO v_tenant_id
    FROM public.cuentas_financieras AS c
    WHERE c.id = NEW.cuenta_financiera_id;

    IF v_tenant_id IS NULL OR v_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'La cuenta financiera no pertenece al tenant del evento'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.arreglo_id IS NOT NULL THEN
    SELECT a.tenant_id INTO v_tenant_id
    FROM public.arreglos AS a
    WHERE a.id = NEW.arreglo_id;

    IF v_tenant_id IS NULL OR v_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'El arreglo no pertenece al tenant del evento'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.operacion_id IS NOT NULL THEN
    SELECT o.tenant_id INTO v_tenant_id
    FROM public.operaciones AS o
    WHERE o.id = NEW.operacion_id;

    IF v_tenant_id IS NULL OR v_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'La operación no pertenece al tenant del evento'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.reversa_evento_id IS NOT NULL THEN
    SELECT e.tenant_id INTO v_tenant_id
    FROM public.eventos_financieros AS e
    WHERE e.id = NEW.reversa_evento_id;

    IF v_tenant_id IS NULL OR v_tenant_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'El evento a revertir no pertenece al tenant'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_validar_movimiento_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_evento_tenant uuid;
  v_cuenta_tenant uuid;
BEGIN
  SELECT e.tenant_id INTO v_evento_tenant
  FROM public.eventos_financieros AS e
  WHERE e.id = NEW.evento_id;

  SELECT c.tenant_id INTO v_cuenta_tenant
  FROM public.cuentas_financieras AS c
  WHERE c.id = NEW.cuenta_financiera_id;

  IF v_evento_tenant IS NULL
     OR v_cuenta_tenant IS NULL
     OR v_evento_tenant <> NEW.tenant_id
     OR v_cuenta_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Evento, cuenta y movimiento deben pertenecer al mismo tenant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_validar_link_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_evento_tenant uuid;
BEGIN
  IF NEW.evento_financiero_actual_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.tenant_id INTO v_evento_tenant
  FROM public.eventos_financieros AS e
  WHERE e.id = NEW.evento_financiero_actual_id;

  IF v_evento_tenant IS NULL OR v_evento_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'El evento financiero no pertenece al tenant del registro'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_bloquear_mutacion_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- La limpieza administrativa de un tenant también puede disparar UPDATEs
  -- internos de FK ON DELETE SET NULL entre eventos de reverso.
  IF current_setting('app.finanzas_tenant_cleanup', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Al eliminar la entidad operativa, las FK ON DELETE SET NULL conservan el
  -- historical event and only clear its deleted entity reference. No other
  -- event data may change through this exception.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'eventos_financieros' THEN
    IF (to_jsonb(NEW) - 'arreglo_id' - 'operacion_id')
         IS NOT DISTINCT FROM
       (to_jsonb(OLD) - 'arreglo_id' - 'operacion_id')
       AND (
         NEW.arreglo_id IS NOT DISTINCT FROM OLD.arreglo_id
         OR (OLD.arreglo_id IS NOT NULL AND NEW.arreglo_id IS NULL)
       )
       AND (
         NEW.operacion_id IS NOT DISTINCT FROM OLD.operacion_id
         OR (OLD.operacion_id IS NOT NULL AND NEW.operacion_id IS NULL)
       )
       AND (
         NEW.arreglo_id IS DISTINCT FROM OLD.arreglo_id
         OR NEW.operacion_id IS DISTINCT FROM OLD.operacion_id
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'El libro financiero es inmutable; use un evento de reverso'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER eventos_financieros_validar_tenant
  BEFORE INSERT OR UPDATE ON public.eventos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_evento_tenant();

CREATE TRIGGER movimientos_financieros_validar_tenant
  BEFORE INSERT OR UPDATE ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_movimiento_tenant();

CREATE TRIGGER arreglos_validar_evento_financiero_actual
  BEFORE INSERT OR UPDATE OF evento_financiero_actual_id ON public.arreglos
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_link_evento();

CREATE TRIGGER operaciones_validar_evento_financiero_actual
  BEFORE INSERT OR UPDATE OF evento_financiero_actual_id ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_link_evento();

CREATE TRIGGER eventos_financieros_inmutables
  BEFORE UPDATE OR DELETE ON public.eventos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

CREATE TRIGGER movimientos_financieros_inmutables
  BEFORE UPDATE OR DELETE ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

REVOKE ALL ON FUNCTION public._finanzas_validar_evento_tenant() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_validar_movimiento_tenant() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_validar_link_evento() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_bloquear_mutacion_ledger() FROM PUBLIC, anon, authenticated, service_role;

-- ===========================================================================
-- Helpers privados de escritura. Ninguno se expone por la Data API.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._finanzas_exigir_cuenta(
  p_cuenta_id uuid,
  p_tenant_id uuid,
  p_exigir_activa boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.cuentas_financieras AS c
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = p_tenant_id
    AND (NOT p_exigir_activa OR c.activo)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta financiera no encontrada, inactiva o fuera del tenant (%)', p_cuenta_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_evento_idempotente(
  p_tenant_id uuid,
  p_idempotency_key uuid,
  p_tipo_esperado text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_evento_id uuid;
  v_tipo text;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT e.id, e.tipo
  INTO v_evento_id, v_tipo
  FROM public.eventos_financieros AS e
  WHERE e.tenant_id = p_tenant_id
    AND e.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_tipo <> p_tipo_esperado THEN
    RAISE EXCEPTION 'La idempotency_key ya fue usada para un evento %', v_tipo
      USING ERRCODE = '23505';
  END IF;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_insertar_evento(
  p_tenant_id uuid,
  p_tipo text,
  p_fecha timestamptz,
  p_descripcion text,
  p_cuenta_id uuid,
  p_arreglo_id uuid,
  p_operacion_id uuid,
  p_reversa_evento_id uuid,
  p_idempotency_key uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_evento_id uuid;
BEGIN
  INSERT INTO public.eventos_financieros (
    tenant_id, tipo, fecha, descripcion, cuenta_financiera_id,
    arreglo_id, operacion_id, reversa_evento_id, idempotency_key,
    metadata, created_by
  ) VALUES (
    p_tenant_id, p_tipo, COALESCE(p_fecha, now()), nullif(btrim(p_descripcion), ''), p_cuenta_id,
    p_arreglo_id, p_operacion_id, p_reversa_evento_id, COALESCE(p_idempotency_key, gen_random_uuid()),
    COALESCE(p_metadata, '{}'::jsonb), auth.uid()
  )
  RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_insertar_movimiento(
  p_tenant_id uuid,
  p_evento_id uuid,
  p_cuenta_id uuid,
  p_importe numeric,
  p_categoria_gasto text DEFAULT NULL,
  p_descripcion text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_movimiento_id uuid;
BEGIN
  IF p_importe IS NULL OR p_importe = 0 THEN
    RAISE EXCEPTION 'importe financiero debe ser distinto de cero'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.movimientos_financieros (
    tenant_id, evento_id, cuenta_financiera_id, importe, categoria_gasto, descripcion
  ) VALUES (
    p_tenant_id, p_evento_id, p_cuenta_id, p_importe, p_categoria_gasto,
    nullif(btrim(p_descripcion), '')
  )
  RETURNING id INTO v_movimiento_id;

  RETURN v_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_reversar_evento(
  p_evento_id uuid,
  p_fecha timestamptz,
  p_descripcion text,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_evento public.eventos_financieros%ROWTYPE;
  v_reversa_id uuid;
  v_existente_id uuid;
  v_movimiento record;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_evento_id IS NULL THEN
    RAISE EXCEPTION 'evento_id requerido' USING ERRCODE = '22023';
  END IF;

  SELECT e.* INTO v_evento
  FROM public.eventos_financieros AS e
  WHERE e.id = p_evento_id
    AND e.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento financiero no encontrado (%)', p_evento_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_evento.tipo = 'REVERSO' THEN
    RAISE EXCEPTION 'No se puede revertir un evento de reverso'
      USING ERRCODE = '55000';
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(
    v_tenant_id, p_idempotency_key, 'REVERSO'
  );
  IF v_existente_id IS NOT NULL THEN
    PERFORM 1
    FROM public.eventos_financieros AS e
    WHERE e.id = v_existente_id
      AND e.reversa_evento_id = p_evento_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La idempotency_key corresponde a otro reverso'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existente_id;
  END IF;

  SELECT e.id INTO v_existente_id
  FROM public.eventos_financieros AS e
  WHERE e.reversa_evento_id = p_evento_id
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'El evento financiero % ya fue revertido', p_evento_id
      USING ERRCODE = '55000';
  END IF;

  v_reversa_id := public._finanzas_insertar_evento(
    p_tenant_id := v_tenant_id,
    p_tipo := 'REVERSO',
    p_fecha := COALESCE(p_fecha, now()),
    p_descripcion := COALESCE(nullif(btrim(p_descripcion), ''), 'Reverso de evento financiero'),
    p_cuenta_id := v_evento.cuenta_financiera_id,
    p_arreglo_id := v_evento.arreglo_id,
    p_operacion_id := v_evento.operacion_id,
    p_reversa_evento_id := v_evento.id,
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object(
      'tipo_revertido', v_evento.tipo,
      'evento_revertido_id', v_evento.id,
      'operacion_revertida_id', v_evento.operacion_id,
      'arreglo_revertido_id', v_evento.arreglo_id
    )
  );

  FOR v_movimiento IN
    SELECT m.cuenta_financiera_id, m.importe, m.categoria_gasto, m.descripcion
    FROM public.movimientos_financieros AS m
    WHERE m.evento_id = v_evento.id
    ORDER BY m.created_at, m.id
  LOOP
    PERFORM public._finanzas_exigir_cuenta(
      v_movimiento.cuenta_financiera_id, v_tenant_id, false
    );
    PERFORM public._finanzas_insertar_movimiento(
      v_tenant_id, v_reversa_id, v_movimiento.cuenta_financiera_id,
      -v_movimiento.importe, v_movimiento.categoria_gasto, v_movimiento.descripcion
    );
  END LOOP;

  IF v_evento.arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos
    SET evento_financiero_actual_id = v_reversa_id
    WHERE id = v_evento.arreglo_id
      AND tenant_id = v_tenant_id;
  END IF;

  IF v_evento.operacion_id IS NOT NULL THEN
    UPDATE public.operaciones
    SET evento_financiero_actual_id = v_reversa_id
    WHERE id = v_evento.operacion_id
      AND tenant_id = v_tenant_id;
  END IF;

  RETURN v_reversa_id;
END;
$$;

REVOKE ALL ON FUNCTION public._finanzas_exigir_cuenta(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_evento_idempotente(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_insertar_evento(uuid, text, timestamptz, text, uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_insertar_movimiento(uuid, uuid, uuid, numeric, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_reversar_evento(uuid, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ===========================================================================
-- Cuentas financieras y sus saldos derivados
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_cuentas()
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  nombre text,
  tipo text,
  activo boolean,
  saldo_inicial numeric,
  saldo_actual numeric,
  saldo numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.tenant_id,
    c.nombre,
    c.tipo,
    c.activo,
    COALESCE(SUM(m.importe) FILTER (WHERE e.tipo = 'APERTURA_CUENTA'), 0)::numeric AS saldo_inicial,
    COALESCE(SUM(m.importe), 0)::numeric AS saldo_actual,
    COALESCE(SUM(m.importe), 0)::numeric AS saldo,
    c.created_at,
    c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.movimientos_financieros AS m
    ON m.cuenta_financiera_id = c.id
  LEFT JOIN public.eventos_financieros AS e ON e.id = m.evento_id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, lower(c.nombre), c.created_at;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_cuenta(p_cuenta_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  nombre text,
  tipo text,
  activo boolean,
  saldo_inicial numeric,
  saldo_actual numeric,
  saldo numeric,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.tenant_id,
    c.nombre,
    c.tipo,
    c.activo,
    COALESCE(SUM(m.importe) FILTER (WHERE e.tipo = 'APERTURA_CUENTA'), 0)::numeric AS saldo_inicial,
    COALESCE(SUM(m.importe), 0)::numeric AS saldo_actual,
    COALESCE(SUM(m.importe), 0)::numeric AS saldo,
    c.created_at,
    c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.movimientos_financieros AS m
    ON m.cuenta_financiera_id = c.id
  LEFT JOIN public.eventos_financieros AS e ON e.id = m.evento_id
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_crear_cuenta(
  p_nombre text,
  p_tipo text,
  p_saldo_inicial numeric DEFAULT 0,
  p_fecha timestamptz DEFAULT now(),
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_nombre text := nullif(btrim(p_nombre), '');
  v_tipo text := upper(btrim(coalesce(p_tipo, '')));
  v_cuenta_id uuid;
  v_evento_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'nombre de cuenta requerido' USING ERRCODE = '22023';
  END IF;
  IF v_tipo NOT IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO') THEN
    RAISE EXCEPTION 'tipo de cuenta inválido (%)', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(
    v_tenant_id, p_idempotency_key, 'APERTURA_CUENTA'
  );
  IF v_existente_id IS NOT NULL THEN
    SELECT e.cuenta_financiera_id INTO v_cuenta_id
    FROM public.eventos_financieros AS e
    WHERE e.id = v_existente_id;
    RETURN v_cuenta_id;
  END IF;

  INSERT INTO public.cuentas_financieras (tenant_id, nombre, tipo)
  VALUES (v_tenant_id, v_nombre, v_tipo)
  RETURNING id INTO v_cuenta_id;

  v_evento_id := public._finanzas_insertar_evento(
    p_tenant_id := v_tenant_id,
    p_tipo := 'APERTURA_CUENTA',
    p_fecha := COALESCE(p_fecha, now()),
    p_descripcion := 'Saldo inicial de cuenta',
    p_cuenta_id := v_cuenta_id,
    p_arreglo_id := NULL,
    p_operacion_id := NULL,
    p_reversa_evento_id := NULL,
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('cuenta_financiera_id', v_cuenta_id)
  );

  IF COALESCE(p_saldo_inicial, 0) <> 0 THEN
    PERFORM public._finanzas_insertar_movimiento(
      v_tenant_id, v_evento_id, v_cuenta_id, p_saldo_inicial,
      NULL, 'Saldo inicial'
    );
  END IF;

  RETURN v_cuenta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_cuenta(
  p_cuenta_id uuid,
  p_nombre text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_activo boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

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
      tipo = COALESCE(v_tipo, c.tipo),
      activo = COALESCE(p_activo, c.activo)
  WHERE c.id = p_cuenta_id
    AND c.tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END;
$$;

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
  SET activo = false
  WHERE id = p_cuenta_id
    AND tenant_id = v_tenant_id;

  RETURN p_cuenta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_movimientos(
  p_cuenta_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  evento_id uuid,
  tipo text,
  fecha timestamptz,
  created_at timestamptz,
  cuenta_financiera_id uuid,
  importe numeric,
  categoria_gasto text,
  descripcion text,
  arreglo_id uuid,
  operacion_id uuid,
  reversa_evento_id uuid
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    m.id,
    e.id AS evento_id,
    e.tipo,
    e.fecha,
    e.created_at,
    m.cuenta_financiera_id,
    m.importe,
    m.categoria_gasto,
    COALESCE(m.descripcion, e.descripcion) AS descripcion,
    e.arreglo_id,
    e.operacion_id,
    e.reversa_evento_id
  FROM public.movimientos_financieros AS m
  JOIN public.eventos_financieros AS e ON e.id = m.evento_id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR e.fecha >= p_from)
    AND (p_to IS NULL OR e.fecha < p_to)
  ORDER BY e.fecha DESC, e.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamptz, timestamptz, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_cuentas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamptz, timestamptz, int, int) TO authenticated, service_role;

-- ===========================================================================
-- Transferencias entre cuentas
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_transferir(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_importe numeric,
  p_fecha timestamptz DEFAULT now(),
  p_descripcion text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_evento_id uuid;
  v_existente_id uuid;
  v_descripcion text := COALESCE(nullif(btrim(p_descripcion), ''), 'Transferencia entre cuentas');
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_cuenta_origen_id IS NULL OR p_cuenta_destino_id IS NULL THEN
    RAISE EXCEPTION 'cuenta origen y cuenta destino requeridas' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'La cuenta origen y destino deben ser distintas' USING ERRCODE = '22023';
  END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(
    v_tenant_id, p_idempotency_key, 'TRANSFERENCIA'
  );
  IF v_existente_id IS NOT NULL THEN
    RETURN v_existente_id;
  END IF;

  -- Bloqueo canónico para que transferencias inversas concurrentes no generen deadlock.
  IF p_cuenta_origen_id::text < p_cuenta_destino_id::text THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
  ELSE
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
  END IF;

  v_evento_id := public._finanzas_insertar_evento(
    p_tenant_id := v_tenant_id,
    p_tipo := 'TRANSFERENCIA',
    p_fecha := COALESCE(p_fecha, now()),
    p_descripcion := v_descripcion,
    p_cuenta_id := NULL,
    p_arreglo_id := NULL,
    p_operacion_id := NULL,
    p_reversa_evento_id := NULL,
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object(
      'cuenta_origen_id', p_cuenta_origen_id,
      'cuenta_destino_id', p_cuenta_destino_id
    )
  );

  PERFORM public._finanzas_insertar_movimiento(
    v_tenant_id, v_evento_id, p_cuenta_origen_id, -p_importe, NULL, v_descripcion
  );
  PERFORM public._finanzas_insertar_movimiento(
    v_tenant_id, v_evento_id, p_cuenta_destino_id, p_importe, NULL, v_descripcion
  );

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_transferencia(p_transferencia_id uuid)
RETURNS TABLE (
  transferencia_id uuid,
  fecha timestamptz,
  created_at timestamptz,
  descripcion text,
  cuenta_origen_id uuid,
  cuenta_origen_nombre text,
  cuenta_destino_id uuid,
  cuenta_destino_nombre text,
  importe numeric,
  reversa_evento_id uuid
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    e.id AS transferencia_id,
    e.fecha,
    e.created_at,
    e.descripcion,
    mo.cuenta_financiera_id AS cuenta_origen_id,
    co.nombre AS cuenta_origen_nombre,
    md.cuenta_financiera_id AS cuenta_destino_id,
    cd.nombre AS cuenta_destino_nombre,
    abs(mo.importe)::numeric AS importe,
    r.id AS reversa_evento_id
  FROM public.eventos_financieros AS e
  JOIN public.movimientos_financieros AS mo
    ON mo.evento_id = e.id AND mo.importe < 0
  JOIN public.movimientos_financieros AS md
    ON md.evento_id = e.id AND md.importe > 0
  JOIN public.cuentas_financieras AS co ON co.id = mo.cuenta_financiera_id
  JOIN public.cuentas_financieras AS cd ON cd.id = md.cuenta_financiera_id
  LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
  WHERE e.id = p_transferencia_id
    AND e.tipo = 'TRANSFERENCIA'
    AND e.tenant_id = (SELECT public.current_tenant_id());
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_transferencia(
  p_transferencia_id uuid,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_importe numeric,
  p_fecha timestamptz,
  p_descripcion text,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(
    v_tenant_id, p_idempotency_key, 'TRANSFERENCIA'
  );
  IF v_existente_id IS NOT NULL THEN
    RETURN v_existente_id;
  END IF;

  SELECT e.tipo INTO v_tipo
  FROM public.eventos_financieros AS e
  WHERE e.id = p_transferencia_id
    AND e.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Transferencia no encontrada (%)', p_transferencia_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'TRANSFERENCIA' THEN
    RAISE EXCEPTION 'El evento % no es una transferencia', p_transferencia_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_reversar_evento(
    p_transferencia_id, COALESCE(p_fecha, now()), 'Reverso por actualización de transferencia', NULL
  );

  RETURN public.rpc_finanzas_transferir(
    p_cuenta_origen_id,
    p_cuenta_destino_id,
    p_importe,
    COALESCE(p_fecha, now()),
    p_descripcion,
    p_idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_transferencia(
  p_transferencia_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT e.tipo INTO v_tipo
  FROM public.eventos_financieros AS e
  WHERE e.id = p_transferencia_id
    AND e.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Transferencia no encontrada (%)', p_transferencia_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'TRANSFERENCIA' THEN
    RAISE EXCEPTION 'El evento % no es una transferencia', p_transferencia_id USING ERRCODE = '22023';
  END IF;

  RETURN public._finanzas_reversar_evento(
    p_transferencia_id, now(), 'Anulación de transferencia', p_idempotency_key
  );
END;
$$;

-- ===========================================================================
-- Gastos financieros categorizados
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_registrar_gasto(
  p_cuenta_id uuid,
  p_categoria text,
  p_importe numeric,
  p_descripcion text,
  p_fecha timestamptz DEFAULT now(),
  p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL,
  p_operacion_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_categoria text := upper(btrim(coalesce(p_categoria, '')));
  v_descripcion text := nullif(btrim(p_descripcion), '');
  v_evento_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF v_descripcion IS NULL THEN
    RAISE EXCEPTION 'descripción de gasto requerida' USING ERRCODE = '22023';
  END IF;
  IF v_categoria NOT IN (
    'ALQUILER', 'SERVICIOS', 'SUELDOS_HONORARIOS', 'IMPUESTOS',
    'INSUMOS_REPUESTOS', 'HERRAMIENTAS_EQUIPAMIENTO', 'MANTENIMIENTO',
    'SEGUROS', 'TRANSPORTE_COMBUSTIBLE', 'MARKETING_PUBLICIDAD',
    'COMISIONES_GASTOS_BANCARIOS', 'OTROS'
  ) THEN
    RAISE EXCEPTION 'categoría de gasto inválida (%)', p_categoria USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(v_tenant_id, p_idempotency_key, 'GASTO');
  IF v_existente_id IS NOT NULL THEN
    RETURN v_existente_id;
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  v_evento_id := public._finanzas_insertar_evento(
    p_tenant_id := v_tenant_id,
    p_tipo := 'GASTO',
    p_fecha := COALESCE(p_fecha, now()),
    p_descripcion := v_descripcion,
    p_cuenta_id := p_cuenta_id,
    p_arreglo_id := p_arreglo_id,
    p_operacion_id := p_operacion_id,
    p_reversa_evento_id := NULL,
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('categoria_gasto', v_categoria)
  );

  PERFORM public._finanzas_insertar_movimiento(
    v_tenant_id, v_evento_id, p_cuenta_id, -p_importe, v_categoria, v_descripcion
  );

  IF p_arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos
    SET evento_financiero_actual_id = v_evento_id
    WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  END IF;
  IF p_operacion_id IS NOT NULL THEN
    UPDATE public.operaciones
    SET evento_financiero_actual_id = v_evento_id
    WHERE id = p_operacion_id AND tenant_id = v_tenant_id;
  END IF;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_gastos(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  gasto_id uuid,
  fecha timestamptz,
  created_at timestamptz,
  cuenta_financiera_id uuid,
  cuenta_financiera_nombre text,
  categoria_gasto text,
  descripcion text,
  importe numeric,
  reversa_evento_id uuid
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    e.id AS gasto_id,
    e.fecha,
    e.created_at,
    m.cuenta_financiera_id,
    c.nombre AS cuenta_financiera_nombre,
    m.categoria_gasto,
    COALESCE(m.descripcion, e.descripcion) AS descripcion,
    abs(m.importe)::numeric AS importe,
    r.id AS reversa_evento_id
  FROM public.eventos_financieros AS e
  JOIN public.movimientos_financieros AS m ON m.evento_id = e.id
  JOIN public.cuentas_financieras AS c ON c.id = m.cuenta_financiera_id
  LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
  WHERE e.tipo = 'GASTO'
    AND e.tenant_id = (SELECT public.current_tenant_id())
    AND r.id IS NULL
    AND (p_from IS NULL OR e.fecha >= p_from)
    AND (p_to IS NULL OR e.fecha < p_to)
  ORDER BY e.fecha DESC, e.created_at DESC, e.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_gasto(p_gasto_id uuid)
RETURNS TABLE (
  gasto_id uuid,
  fecha timestamptz,
  created_at timestamptz,
  cuenta_financiera_id uuid,
  cuenta_financiera_nombre text,
  categoria_gasto text,
  descripcion text,
  importe numeric,
  reversa_evento_id uuid
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT *
  FROM public.rpc_finanzas_listar_gastos(NULL, NULL, 500, 0)
  WHERE gasto_id = p_gasto_id;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_gasto(
  p_gasto_id uuid,
  p_cuenta_id uuid,
  p_categoria text,
  p_importe numeric,
  p_descripcion text,
  p_fecha timestamptz,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_existente_id uuid;
  v_arreglo_id uuid;
  v_operacion_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(v_tenant_id, p_idempotency_key, 'GASTO');
  IF v_existente_id IS NOT NULL THEN
    RETURN v_existente_id;
  END IF;

  SELECT e.tipo, e.arreglo_id, e.operacion_id
  INTO v_tipo, v_arreglo_id, v_operacion_id
  FROM public.eventos_financieros AS e
  WHERE e.id = p_gasto_id AND e.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Gasto no encontrado (%)', p_gasto_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'GASTO' THEN
    RAISE EXCEPTION 'El evento % no es un gasto', p_gasto_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_reversar_evento(
    p_gasto_id, COALESCE(p_fecha, now()), 'Reverso por actualización de gasto', NULL
  );

  RETURN public.rpc_finanzas_registrar_gasto(
    p_cuenta_id, p_categoria, p_importe, p_descripcion,
    COALESCE(p_fecha, now()), p_idempotency_key, v_arreglo_id, v_operacion_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_gasto(
  p_gasto_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT e.tipo INTO v_tipo
  FROM public.eventos_financieros AS e
  WHERE e.id = p_gasto_id AND e.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Gasto no encontrado (%)', p_gasto_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'GASTO' THEN
    RAISE EXCEPTION 'El evento % no es un gasto', p_gasto_id USING ERRCODE = '22023';
  END IF;

  RETURN public._finanzas_reversar_evento(
    p_gasto_id, now(), 'Anulación de gasto', p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_transferir(uuid, uuid, numeric, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_transferencia(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_transferencia(uuid, uuid, uuid, numeric, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_transferencia(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_registrar_gasto(uuid, text, numeric, text, timestamptz, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_gastos(timestamptz, timestamptz, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_gasto(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_gasto(uuid, uuid, text, numeric, text, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_gasto(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_transferir(uuid, uuid, numeric, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_transferencia(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_transferencia(uuid, uuid, uuid, numeric, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_transferencia(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_registrar_gasto(uuid, text, numeric, text, timestamptz, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_gastos(timestamptz, timestamptz, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_gasto(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_gasto(uuid, uuid, text, numeric, text, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_gasto(uuid, uuid) TO authenticated, service_role;

-- ===========================================================================
-- Cobro y anulación de cobro de arreglos
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id uuid,
  p_cuenta_id uuid,
  p_fecha_cobro timestamptz,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_precio_final numeric;
  v_esta_pago boolean;
  v_evento_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(
    v_tenant_id, p_idempotency_key, 'COBRO_ARREGLO'
  );
  IF v_existente_id IS NOT NULL THEN
    PERFORM 1
    FROM public.eventos_financieros AS e
    WHERE e.id = v_existente_id AND e.arreglo_id = p_arreglo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La idempotency_key corresponde a otro arreglo'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existente_id;
  END IF;

  SELECT a.precio_final, a.esta_pago
  INTO v_precio_final, v_esta_pago
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_esta_pago, false) THEN
    RAISE EXCEPTION 'El arreglo ya se encuentra cobrado' USING ERRCODE = '55000';
  END IF;
  IF COALESCE(v_precio_final, 0) <= 0 THEN
    RAISE EXCEPTION 'El arreglo debe tener precio_final mayor a cero para cobrarlo'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  v_evento_id := public._finanzas_insertar_evento(
    p_tenant_id := v_tenant_id,
    p_tipo := 'COBRO_ARREGLO',
    p_fecha := COALESCE(p_fecha_cobro, now()),
    p_descripcion := 'Cobro de arreglo ' || p_arreglo_id::text,
    p_cuenta_id := p_cuenta_id,
    p_arreglo_id := p_arreglo_id,
    p_operacion_id := NULL,
    p_reversa_evento_id := NULL,
    p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('precio_final', v_precio_final)
  );

  PERFORM public._finanzas_insertar_movimiento(
    v_tenant_id, v_evento_id, p_cuenta_id, v_precio_final, NULL,
    'Cobro de arreglo'
  );

  UPDATE public.arreglos
  SET esta_pago = true,
      evento_financiero_actual_id = v_evento_id
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(
  p_arreglo_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_esta_pago boolean;
  v_cobro_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_arreglo_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_evento_idempotente(v_tenant_id, p_idempotency_key, 'REVERSO');
  IF v_existente_id IS NOT NULL THEN
    PERFORM 1
    FROM public.eventos_financieros AS e
    WHERE e.id = v_existente_id AND e.arreglo_id = p_arreglo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La idempotency_key corresponde a otro arreglo'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existente_id;
  END IF;

  SELECT a.esta_pago INTO v_esta_pago
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;
  IF NOT COALESCE(v_esta_pago, false) THEN
    RAISE EXCEPTION 'El arreglo no está cobrado' USING ERRCODE = '55000';
  END IF;

  SELECT e.id INTO v_cobro_id
  FROM public.eventos_financieros AS e
  LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
  WHERE e.tenant_id = v_tenant_id
    AND e.arreglo_id = p_arreglo_id
    AND e.tipo = 'COBRO_ARREGLO'
    AND r.id IS NULL
  ORDER BY e.fecha DESC, e.created_at DESC, e.id DESC
  LIMIT 1
  FOR UPDATE OF e;

  IF v_cobro_id IS NULL THEN
    RAISE EXCEPTION 'No existe un cobro financiero vigente para el arreglo'
      USING ERRCODE = 'P0002';
  END IF;

  v_existente_id := public._finanzas_reversar_evento(
    v_cobro_id, now(), 'Anulación de cobro de arreglo', p_idempotency_key
  );

  UPDATE public.arreglos
  SET esta_pago = false,
      evento_financiero_actual_id = v_existente_id
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id;

  RETURN v_existente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid, uuid, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid, uuid) TO authenticated, service_role;

-- ===========================================================================
-- Operaciones de stock con impacto financiero opcional
-- ===========================================================================

-- Cambia la firma histórica de cinco argumentos por una compatible con cuenta
-- e idempotencia. Los argumentos nuevos son opcionales al final.
DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(
  public.tipo_operacion, uuid, jsonb, uuid, timestamptz
);

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo public.tipo_operacion,
  p_taller_id uuid,
  p_lineas jsonb,
  p_arreglo_id uuid DEFAULT NULL,
  p_fecha timestamptz DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_evento_id uuid;
  v_existente_id uuid;
  v_financial_tipo text;
  v_total numeric := 0;
  v_linea jsonb;
  v_stock_id uuid;
  v_cantidad int;
  v_monto numeric;
  v_delta int;
  v_rowcount int;
  v_expected_ids int;
  v_found_ids int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_tipo IS NULL OR p_tipo::text = 'GASTO' THEN
    RAISE EXCEPTION 'GASTO debe registrarse con rpc_finanzas_registrar_gasto'
      USING ERRCODE = '22023';
  END IF;
  IF p_lineas IS NULL
     OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'lineas debe ser un array no vacío' USING ERRCODE = '22023';
  END IF;

  v_financial_tipo := CASE p_tipo
    WHEN 'COMPRA'::public.tipo_operacion THEN 'COMPRA_STOCK'
    WHEN 'VENTA'::public.tipo_operacion THEN 'VENTA_STOCK'
    ELSE NULL
  END;

  IF v_financial_tipo IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para COMPRA o VENTA'
      USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND v_financial_tipo IS NULL THEN
    RAISE EXCEPTION 'Solo COMPRA y VENTA pueden impactar una cuenta financiera'
      USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requiere cuenta_id para una operación financiera'
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    v_existente_id := public._finanzas_evento_idempotente(
      v_tenant_id, p_idempotency_key, v_financial_tipo
    );
    IF v_existente_id IS NOT NULL THEN
      SELECT e.operacion_id INTO v_operacion_id
      FROM public.eventos_financieros AS e
      WHERE e.id = v_existente_id;
      IF v_operacion_id IS NULL THEN
        RAISE EXCEPTION 'La idempotency_key no tiene una operación de stock asociada'
          USING ERRCODE = '55000';
      END IF;
      RETURN v_operacion_id;
    END IF;
  END IF;

  PERFORM 1
  FROM public.talleres AS t
  WHERE t.id = p_taller_id
    AND t.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Taller no encontrado o fuera del tenant (%)', p_taller_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    IF p_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO' USING ERRCODE = '22023';
    END IF;
    PERFORM 1
    FROM public.arreglos AS a
    WHERE a.id = p_arreglo_id
      AND a.tenant_id = v_tenant_id
      AND a.taller_id = p_taller_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Arreglo no encontrado para el taller indicado' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_arreglo_id IS NOT NULL THEN
    RAISE EXCEPTION 'arreglo_id solo es válido para ASIGNACION_ARREGLO'
      USING ERRCODE = '22023';
  END IF;

  v_expected_ids := (
    SELECT COUNT(DISTINCT (linea ->> 'stock_id')::uuid)
    FROM jsonb_array_elements(p_lineas) AS linea
  );
  v_found_ids := (
    SELECT COUNT(*)
    FROM public.stocks AS s
    WHERE s.tenant_id = v_tenant_id
      AND s.taller_id = p_taller_id
      AND s.id IN (
        SELECT DISTINCT (linea ->> 'stock_id')::uuid
        FROM jsonb_array_elements(p_lineas) AS linea
      )
  );
  IF v_expected_ids <> v_found_ids THEN
    RAISE EXCEPTION 'Algún stock_id no existe o no pertenece al taller'
      USING ERRCODE = 'P0002';
  END IF;

  -- Bloquea todos los stocks antes de alterar cantidades.
  PERFORM 1
  FROM public.stocks AS s
  WHERE s.tenant_id = v_tenant_id
    AND s.taller_id = p_taller_id
    AND s.id IN (
      SELECT DISTINCT (linea ->> 'stock_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS linea
    )
  ORDER BY s.id
  FOR UPDATE;

  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, p_tipo, p_taller_id, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_stock_id := (v_linea ->> 'stock_id')::uuid;
    v_cantidad := (v_linea ->> 'cantidad')::int;
    v_monto := COALESCE((v_linea ->> 'monto_unitario')::numeric, 0);

    IF v_stock_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Línea inválida (stock_id %, cantidad %)', v_stock_id, v_cantidad
        USING ERRCODE = '22023';
    END IF;
    IF v_monto < 0 THEN
      RAISE EXCEPTION 'monto_unitario no puede ser negativo' USING ERRCODE = '22023';
    END IF;

    v_delta := CASE p_tipo
      WHEN 'COMPRA'::public.tipo_operacion THEN v_cantidad
      WHEN 'VENTA'::public.tipo_operacion THEN -v_cantidad
      WHEN 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN -v_cantidad
      WHEN 'AJUSTE'::public.tipo_operacion THEN COALESCE((v_linea ->> 'delta_cantidad')::int, v_cantidad)
      ELSE 0
    END;
    IF v_delta = 0 THEN
      RAISE EXCEPTION 'delta inválido para stock %', v_stock_id USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad
    ) VALUES (
      v_operacion_id, v_stock_id, v_cantidad, v_monto, v_delta
    );

    IF v_delta < 0 THEN
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id
        AND s.tenant_id = v_tenant_id
        AND s.cantidad >= -v_delta;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001';
      END IF;
    ELSE
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.id = v_stock_id
        AND s.tenant_id = v_tenant_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id USING ERRCODE = 'P0002';
      END IF;
    END IF;

    v_total := v_total + (v_cantidad * v_monto);
  END LOOP;

  IF p_cuenta_id IS NOT NULL THEN
    IF v_total <= 0 THEN
      RAISE EXCEPTION 'La operación financiera debe tener importe mayor a cero'
        USING ERRCODE = '22023';
    END IF;

    v_evento_id := public._finanzas_insertar_evento(
      p_tenant_id := v_tenant_id,
      p_tipo := v_financial_tipo,
      p_fecha := COALESCE(p_fecha, now()),
      p_descripcion := CASE p_tipo
        WHEN 'COMPRA'::public.tipo_operacion THEN 'Compra de stock'
        ELSE 'Venta de stock'
      END,
      p_cuenta_id := p_cuenta_id,
      p_arreglo_id := NULL,
      p_operacion_id := v_operacion_id,
      p_reversa_evento_id := NULL,
      p_idempotency_key := p_idempotency_key,
      p_metadata := jsonb_build_object('tipo_operacion', p_tipo::text, 'importe_operacion', v_total)
    );

    PERFORM public._finanzas_insertar_movimiento(
      v_tenant_id,
      v_evento_id,
      p_cuenta_id,
      CASE WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN -v_total ELSE v_total END,
      NULL,
      CASE WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN 'Compra de stock' ELSE 'Venta de stock' END
    );

    UPDATE public.operaciones
    SET evento_financiero_actual_id = v_evento_id
    WHERE id = v_operacion_id
      AND tenant_id = v_tenant_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);

CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock(
  p_operacion_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_evento_id uuid;
  v_existente_id uuid;
  v_linea record;
  v_reverse int;
  v_rowcount int;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_operacion_id IS NULL THEN
    RAISE EXCEPTION 'operacion_id requerido' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    v_existente_id := public._finanzas_evento_idempotente(v_tenant_id, p_idempotency_key, 'REVERSO');
    IF v_existente_id IS NOT NULL THEN
      PERFORM 1
      FROM public.eventos_financieros AS e
      WHERE e.id = v_existente_id
        AND e.metadata ->> 'operacion_revertida_id' = p_operacion_id::text;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La idempotency_key corresponde a otra operación'
          USING ERRCODE = '23505';
      END IF;
      RETURN p_operacion_id;
    END IF;
  END IF;

  SELECT o.id INTO v_operacion_id
  FROM public.operaciones AS o
  WHERE o.id = p_operacion_id
    AND o.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operación no encontrada (%)', p_operacion_id USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id INTO v_evento_id
  FROM public.eventos_financieros AS e
  LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
  WHERE e.tenant_id = v_tenant_id
    AND e.operacion_id = v_operacion_id
    AND e.tipo IN ('COMPRA_STOCK', 'VENTA_STOCK')
    AND r.id IS NULL
  ORDER BY e.fecha DESC, e.created_at DESC, e.id DESC
  LIMIT 1
  FOR UPDATE OF e;

  IF v_evento_id IS NOT NULL THEN
    PERFORM public._finanzas_reversar_evento(
      v_evento_id, now(), 'Anulación de operación de stock', p_idempotency_key
    );
  END IF;

  FOR v_linea IN
    SELECT l.stock_id, l.delta_cantidad
    FROM public.operaciones_lineas AS l
    WHERE l.operacion_id = v_operacion_id
    ORDER BY l.stock_id
    FOR UPDATE
  LOOP
    v_reverse := -v_linea.delta_cantidad;
    IF v_reverse < 0 THEN
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad + v_reverse,
          updated_at = now()
      WHERE s.id = v_linea.stock_id
        AND s.tenant_id = v_tenant_id
        AND s.cantidad >= -v_reverse;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_linea.stock_id USING ERRCODE = 'P0001';
      END IF;
    ELSE
      UPDATE public.stocks AS s
      SET cantidad = s.cantidad + v_reverse,
          updated_at = now()
      WHERE s.id = v_linea.stock_id
        AND s.tenant_id = v_tenant_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'stock no encontrado (%)', v_linea.stock_id USING ERRCODE = 'P0002';
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.operaciones
  WHERE id = v_operacion_id
    AND tenant_id = v_tenant_id;

  RETURN v_operacion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion_con_stock(
  p_operacion_id uuid,
  p_tipo public.tipo_operacion,
  p_taller_id uuid,
  p_lineas jsonb,
  p_fecha timestamptz,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo_financiero text;
  v_evento_id uuid;
  v_nueva_operacion_id uuid;
  v_arreglo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  v_tipo_financiero := CASE p_tipo
    WHEN 'COMPRA'::public.tipo_operacion THEN 'COMPRA_STOCK'
    WHEN 'VENTA'::public.tipo_operacion THEN 'VENTA_STOCK'
    ELSE NULL
  END;

  IF v_tipo_financiero IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para COMPRA o VENTA'
      USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND v_tipo_financiero IS NULL THEN
    RAISE EXCEPTION 'Solo COMPRA y VENTA pueden impactar una cuenta financiera'
      USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requiere cuenta_id para una operacion financiera'
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NOT NULL THEN
    v_evento_id := public._finanzas_evento_idempotente(
      v_tenant_id, p_idempotency_key, v_tipo_financiero
    );
    IF v_evento_id IS NOT NULL THEN
      SELECT e.operacion_id INTO v_nueva_operacion_id
      FROM public.eventos_financieros AS e
      WHERE e.id = v_evento_id;
      IF v_nueva_operacion_id IS NOT NULL THEN
        RETURN v_nueva_operacion_id;
      END IF;
    END IF;
  END IF;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.operacion_id = p_operacion_id
      AND o.tenant_id = v_tenant_id;
    IF v_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'La asignación no tiene arreglo asociado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM public.rpc_borrar_operacion_con_stock(p_operacion_id, NULL);

  RETURN public.rpc_crear_operacion_con_stock(
    p_tipo,
    p_taller_id,
    p_lineas,
    v_arreglo_id,
    COALESCE(p_fecha, now()),
    p_cuenta_id,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamptz, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, public.tipo_operacion, uuid, jsonb, timestamptz, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamptz, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, public.tipo_operacion, uuid, jsonb, timestamptz, uuid, uuid) TO authenticated, service_role;

-- ===========================================================================
-- Listado paginado unificado para Operaciones (stock) y Gastos (caja)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  tipo text,
  taller_id uuid,
  fecha timestamptz,
  created_at timestamptz,
  lineas jsonb,
  gasto_id uuid,
  descripcion text,
  categoria_gasto text,
  cuenta_financiera_id uuid,
  cuenta_financiera_nombre text,
  monto numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH operaciones_rows AS (
    SELECT
      o.id,
      o.tipo::text AS tipo,
      o.taller_id,
      o.fecha,
      o.created_at,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'operacion_id', l.operacion_id,
            'stock_id', l.stock_id,
            'cantidad', l.cantidad,
            'monto_unitario', l.monto_unitario,
            'delta_cantidad', l.delta_cantidad,
            'created_at', l.created_at
          ) ORDER BY l.created_at, l.id
        )
        FROM public.operaciones_lineas AS l
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      NULL::uuid AS gasto_id,
      NULL::text AS descripcion,
      NULL::text AS categoria_gasto,
      NULL::uuid AS cuenta_financiera_id,
      NULL::text AS cuenta_financiera_nombre,
      COALESCE((
        SELECT SUM(l.cantidad * l.monto_unitario)
        FROM public.operaciones_lineas AS l
        WHERE l.operacion_id = o.id
      ), 0)::numeric AS monto
    FROM public.operaciones AS o
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  ),
  gastos_rows AS (
    SELECT
      e.id,
      'GASTO'::text AS tipo,
      NULL::uuid AS taller_id,
      e.fecha,
      e.created_at,
      '[]'::jsonb AS lineas,
      e.id AS gasto_id,
      COALESCE(m.descripcion, e.descripcion) AS descripcion,
      m.categoria_gasto,
      m.cuenta_financiera_id,
      c.nombre AS cuenta_financiera_nombre,
      abs(m.importe)::numeric AS monto
    FROM public.eventos_financieros AS e
    JOIN public.movimientos_financieros AS m ON m.evento_id = e.id
    JOIN public.cuentas_financieras AS c ON c.id = m.cuenta_financiera_id
    LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
    WHERE e.tipo = 'GASTO'
      AND r.id IS NULL
      AND e.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR e.fecha >= p_from)
      AND (p_to IS NULL OR e.fecha < p_to)
  ),
  filtered AS (
    SELECT * FROM operaciones_rows
    UNION ALL
    SELECT * FROM gastos_rows
  ),
  typed AS (
    SELECT *
    FROM filtered
    WHERE COALESCE(cardinality(p_tipos), 0) = 0
       OR tipo = ANY(p_tipos)
  )
  SELECT
    id,
    tipo,
    taller_id,
    fecha,
    created_at,
    lineas,
    gasto_id,
    descripcion,
    categoria_gasto,
    cuenta_financiera_id,
    cuenta_financiera_nombre,
    monto,
    COUNT(*) OVER () AS total_count
  FROM typed
  ORDER BY fecha DESC, created_at DESC, id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1)
       * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz, timestamptz, text[], int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz, timestamptz, text[], int, int) TO authenticated, service_role;

-- Las operaciones mantienen sus totales de inventario. El neto de caja viene
-- del libro financiero (sin asignaciones internas de repuestos).
DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]);

CREATE FUNCTION public.rpc_operaciones_stats(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tipos public.tipo_operacion[] DEFAULT NULL
)
RETURNS TABLE (
  ventas numeric,
  compras numeric,
  asignaciones numeric,
  gastos numeric,
  neto numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH operaciones_totales AS (
    SELECT
      COALESCE(SUM(CASE WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS ventas,
      COALESCE(SUM(CASE WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS compras,
      COALESCE(SUM(CASE WHEN o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS asignaciones
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
      AND (COALESCE(cardinality(p_tipos), 0) = 0 OR o.tipo = ANY(p_tipos))
  ),
  movimientos_caja AS (
    SELECT
      m.importe,
      e.tipo AS tipo_evento,
      COALESCE(re.tipo, e.tipo) AS tipo_efectivo
    FROM public.eventos_financieros AS e
    JOIN public.movimientos_financieros AS m ON m.evento_id = e.id
    LEFT JOIN public.eventos_financieros AS re ON re.id = e.reversa_evento_id
    WHERE e.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR e.fecha >= p_from)
      AND (p_to IS NULL OR e.fecha < p_to)
  ),
  finanzas AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN tipo_efectivo = 'GASTO'
          AND (COALESCE(cardinality(p_tipos), 0) = 0 OR 'GASTO' = ANY(p_tipos::text[]))
          THEN -importe
        ELSE 0
      END), 0)::numeric AS gastos,
      COALESCE(SUM(CASE
        WHEN tipo_efectivo = 'APERTURA_CUENTA' THEN 0
        WHEN COALESCE(cardinality(p_tipos), 0) = 0 THEN importe
        WHEN tipo_efectivo = 'COMPRA_STOCK' AND 'COMPRA'::public.tipo_operacion = ANY(p_tipos) THEN importe
        WHEN tipo_efectivo = 'VENTA_STOCK' AND 'VENTA'::public.tipo_operacion = ANY(p_tipos) THEN importe
        WHEN tipo_efectivo = 'GASTO' AND 'GASTO' = ANY(p_tipos::text[]) THEN importe
        ELSE 0
      END), 0)::numeric AS neto
    FROM movimientos_caja
  )
  SELECT o.ventas, o.compras, o.asignaciones, f.gastos, f.neto
  FROM operaciones_totales AS o
  CROSS JOIN finanzas AS f;
$$;

REVOKE ALL ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) TO authenticated, service_role;

-- Mantiene los componentes históricos del dashboard y suma el gasto eventual
-- neto del libro financiero. No sustituye repuestos ni sueldos existentes.
DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_gastos_por_periodo(
  p_from timestamptz,
  p_to timestamptz,
  p_taller_id uuid DEFAULT NULL
)
RETURNS TABLE(label text, repuestos numeric, sueldos numeric, eventuales numeric)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);

  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  compras AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS rep
    FROM public.operaciones AS o
    JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'COMPRA'::public.tipo_operacion
      AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(
      date_trunc('month', p_from),
      date_trunc('month', p_to - interval '1 second'),
      interval '1 month'
    ) AS mes_start
  ),
  sueldo_mes AS (
    SELECT m.mes_start,
           COALESCE(lat.sueldos, 0)::numeric AS sueldos
    FROM meses AS m
    LEFT JOIN LATERAL (
      SELECT SUM(eff.salario) AS sueldos
      FROM (
        SELECT DISTINCT ON (es.empleado_id) es.salario
        FROM public.empleado_salarios AS es
        JOIN public.empleados AS e ON e.id = es.empleado_id
        WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT
      date_trunc(b.trunc_name, e.fecha) AS slot_start,
      COALESCE(SUM(-mf.importe), 0)::numeric AS eventual
    FROM public.eventos_financieros AS e
    JOIN public.movimientos_financieros AS mf ON mf.evento_id = e.id
    LEFT JOIN public.eventos_financieros AS origen ON origen.id = e.reversa_evento_id
    LEFT JOIN public.arreglos AS a ON a.id = e.arreglo_id
    LEFT JOIN public.operaciones AS o ON o.id = e.operacion_id
    WHERE COALESCE(origen.tipo, e.tipo) = 'GASTO'
      AND e.fecha >= p_from AND e.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id OR o.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT
    to_char(s.slot_start, b.label_fmt),
    COALESCE(c.rep, 0),
    COALESCE(sm.sueldos, 0),
    COALESCE(ge.eventual, 0)
  FROM slots AS s
  LEFT JOIN compras AS c USING (slot_start)
  LEFT JOIN sueldo_mes AS sm ON date_trunc(b.trunc_name, sm.mes_start) = s.slot_start
  LEFT JOIN gastos_eventuales AS ge USING (slot_start)
  ORDER BY s.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- Borrar un arreglo conserva la contabilidad: primero genera el reverso de su
-- cobro vigente (si lo hubiera) y recién luego revierte stock / elimina datos.
CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_esta_pago boolean;
  v_cobro_id uuid;
  v_operacion_ids uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;

  SELECT a.esta_pago INTO v_esta_pago
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id INTO v_cobro_id
  FROM public.eventos_financieros AS e
  LEFT JOIN public.eventos_financieros AS r ON r.reversa_evento_id = e.id
  WHERE e.tenant_id = v_tenant_id
    AND e.arreglo_id = p_arreglo_id
    AND e.tipo = 'COBRO_ARREGLO'
    AND r.id IS NULL
  ORDER BY e.fecha DESC, e.created_at DESC, e.id DESC
  LIMIT 1;

  IF v_cobro_id IS NOT NULL THEN
    -- La función también actualiza esta_pago y el link actual del arreglo.
    PERFORM public.rpc_finanzas_anular_cobro_arreglo(p_arreglo_id, NULL);
  ELSIF COALESCE(v_esta_pago, false) THEN
    -- Pago anterior a esta migración: no existe evento que revertir.
    UPDATE public.arreglos
    SET esta_pago = false
    WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  END IF;

  v_operacion_ids := public.obtener_operaciones_por_arreglo_id(p_arreglo_id);
  PERFORM public.rpc_borrar_operaciones_con_stock_lista(v_operacion_ids);

  DELETE FROM public.arreglos
  WHERE id = p_arreglo_id
    AND tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_arreglo(uuid) TO authenticated, service_role;

-- El cleanup administrativo se mantiene explícito: el ledger se borra antes
-- de sus cuentas y antes de los vínculos operativos, habilitando sólo aquí el
-- trigger de borrado de filas inmutables.
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

  PERFORM 1
  FROM public.tenants AS t
  WHERE t.id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el tenant %', p_tenant_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.finanzas_tenant_cleanup', 'on', true);

  DELETE FROM public.movimientos_financieros
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.eventos_financieros
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.cuentas_financieras
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.empleado_salarios
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.detalle_form_custom
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.detalle_arreglo
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_lineas AS ol
  USING public.operaciones AS o
  WHERE ol.operacion_id = o.id
    AND o.tenant_id = p_tenant_id;

  DELETE FROM public.operaciones_asignacion_arreglo AS oaa
  USING public.operaciones AS o
  WHERE oaa.operacion_id = o.id
    AND o.tenant_id = p_tenant_id;

  DELETE FROM public.turnos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.operaciones
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.stocks
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.arreglos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.empleados
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.vehiculos
  WHERE tenant_id = p_tenant_id;

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

  DELETE FROM public.clientes
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.formularios
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.talleres
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.productos
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenant_members
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenants
  WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_tenant(uuid) TO service_role;

-- ===========================================================================
-- Repuestos automáticos y alta de arreglos con la misma cuenta financiera
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_asignar_repuesto_existente_con_compra(
  uuid, uuid, uuid, int, numeric, numeric, uuid, uuid
);

CREATE OR REPLACE FUNCTION public.rpc_asignar_repuesto_existente_con_compra(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_stock_id uuid,
  p_cantidad int,
  p_monto_unitario numeric(12,2),
  p_precio_compra numeric(12,2) DEFAULT NULL,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_fecha timestamptz;
  v_stock_cantidad int;
  v_old_cantidad int;
  v_delta_diff int;
  v_faltante int;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL OR p_taller_id IS NULL OR p_stock_id IS NULL THEN
    RAISE EXCEPTION 'arreglo_id, taller_id y stock_id requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_monto_unitario IS NULL OR p_monto_unitario < 0 THEN
    RAISE EXCEPTION 'cantidad o monto_unitario inválido' USING ERRCODE = '22023';
  END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  SELECT s.cantidad INTO v_stock_cantidad
  FROM public.stocks AS s
  WHERE s.id = p_stock_id AND s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'stock no encontrado (%)', p_stock_id USING ERRCODE = 'P0002'; END IF;

  SELECT abs(l.delta_cantidad) INTO v_old_cantidad
  FROM public.operaciones_lineas AS l
  JOIN public.operaciones AS o ON o.id = l.operacion_id
  JOIN public.operaciones_asignacion_arreglo AS oa ON oa.operacion_id = o.id
  WHERE oa.arreglo_id = p_arreglo_id
    AND l.stock_id = p_stock_id
    AND o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion
    AND o.tenant_id = v_tenant_id;

  v_old_cantidad := COALESCE(v_old_cantidad, 0);
  v_delta_diff := p_cantidad - v_old_cantidad;
  v_faltante := GREATEST(0, v_delta_diff - v_stock_cantidad);

  IF v_faltante > 0 THEN
    IF p_precio_compra IS NULL OR p_precio_compra <= 0 THEN
      RAISE EXCEPTION 'PRECIO_COMPRA_REQUERIDO faltante=%', v_faltante USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.rpc_crear_operacion_con_stock(
      p_tipo := 'COMPRA'::public.tipo_operacion,
      p_taller_id := p_taller_id,
      p_lineas := jsonb_build_array(jsonb_build_object(
        'stock_id', p_stock_id,
        'cantidad', v_faltante,
        'monto_unitario', p_precio_compra
      )),
      p_arreglo_id := NULL,
      p_fecha := v_arreglo_fecha,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := p_idempotency_key
    );
  END IF;

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := p_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_monto_unitario,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_crear_producto_inline_para_arreglo(
  uuid, uuid, text, text, numeric, numeric, int, uuid, uuid
);

CREATE OR REPLACE FUNCTION public.rpc_crear_producto_inline_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_codigo text,
  p_nombre text,
  p_precio_compra numeric(12,2),
  p_precio_venta numeric(12,2),
  p_cantidad int,
  p_categoria_arreglo_id uuid DEFAULT NULL,
  p_empleado_id uuid DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_stock_id uuid;
  v_arreglo_fecha timestamptz;
  v_codigo text := btrim(coalesce(p_codigo, ''));
  v_nombre text := btrim(coalesce(p_nombre, ''));
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL OR p_taller_id IS NULL THEN RAISE EXCEPTION 'arreglo_id y taller_id requeridos' USING ERRCODE = '22023'; END IF;
  IF v_codigo = '' OR v_nombre = '' THEN RAISE EXCEPTION 'codigo y nombre requeridos' USING ERRCODE = '22023'; END IF;
  IF p_precio_compra IS NULL OR p_precio_compra < 0 OR p_precio_venta IS NULL OR p_precio_venta < 0 THEN
    RAISE EXCEPTION 'precios inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'cantidad inválida' USING ERRCODE = '22023'; END IF;

  PERFORM public._lock_arreglo_del_tenant(p_arreglo_id, p_taller_id);
  PERFORM public._check_codigo_no_existe_en_productos(v_codigo);
  SELECT a.fecha INTO v_arreglo_fecha
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id;

  v_stock_id := public._crear_producto_y_stock(
    p_taller_id := p_taller_id,
    p_codigo := v_codigo,
    p_nombre := v_nombre,
    p_precio_compra := p_precio_compra,
    p_precio_venta := p_precio_venta
  );

  PERFORM public.rpc_crear_operacion_con_stock(
    p_tipo := 'COMPRA'::public.tipo_operacion,
    p_taller_id := p_taller_id,
    p_lineas := jsonb_build_array(jsonb_build_object(
      'stock_id', v_stock_id,
      'cantidad', p_cantidad,
      'monto_unitario', p_precio_compra
    )),
    p_arreglo_id := NULL,
    p_fecha := v_arreglo_fecha,
    p_cuenta_id := p_cuenta_id,
    p_idempotency_key := p_idempotency_key
  );

  RETURN public.rpc_set_asignacion_arreglo_linea(
    p_arreglo_id := p_arreglo_id,
    p_taller_id := p_taller_id,
    p_stock_id := v_stock_id,
    p_cantidad := p_cantidad,
    p_monto_unitario := p_precio_venta,
    p_categoria_arreglo_id := p_categoria_arreglo_id,
    p_empleado_id := p_empleado_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION public._asignar_repuestos_existentes_a_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos jsonb,
  p_cuenta_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos IS NULL OR jsonb_array_length(p_repuestos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    PERFORM public.rpc_asignar_repuesto_existente_con_compra(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_stock_id := (v_item ->> 'stock_id')::uuid,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_monto_unitario := (v_item ->> 'monto_unitario')::numeric,
      p_precio_compra := NULLIF(v_item ->> 'precio_compra', '')::numeric,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      -- Cada línea de compra es una operación distinta; no reutiliza la key
      -- del cobro del arreglo ni la de otra línea.
      p_idempotency_key := NULL
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION public._crear_repuestos_nuevos_para_arreglo(
  p_arreglo_id uuid,
  p_taller_id uuid,
  p_repuestos_nuevos jsonb,
  p_cuenta_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_repuestos_nuevos IS NULL OR jsonb_array_length(p_repuestos_nuevos) = 0 THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_repuestos_nuevos) LOOP
    PERFORM public.rpc_crear_producto_inline_para_arreglo(
      p_arreglo_id := p_arreglo_id,
      p_taller_id := p_taller_id,
      p_codigo := v_item ->> 'codigo',
      p_nombre := v_item ->> 'nombre',
      p_precio_compra := (v_item ->> 'precio_compra')::numeric,
      p_precio_venta := (v_item ->> 'precio_venta')::numeric,
      p_cantidad := (v_item ->> 'cantidad')::int,
      p_categoria_arreglo_id := NULLIF(v_item ->> 'categoria_arreglo_id', '')::uuid,
      p_empleado_id := NULLIF(v_item ->> 'empleado_id', '')::uuid,
      p_cuenta_id := p_cuenta_id,
      p_idempotency_key := NULL
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric,
  numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb
);

CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid,
  p_taller_id uuid,
  p_estado public.estado_arreglo,
  p_descripcion text,
  p_kilometraje_leido int,
  p_fecha timestamptz,
  p_observaciones text,
  p_precio_final numeric(10,2),
  p_precio_sin_iva numeric(10,2),
  p_esta_pago boolean,
  p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb,
  p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb,
  p_detalle_formulario jsonb DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL,
  p_fecha_cobro timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_id uuid;
  v_evento_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_vehiculo_id IS NULL THEN RAISE EXCEPTION 'vehiculo_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_taller_id IS NULL THEN RAISE EXCEPTION 'taller_id requerido' USING ERRCODE = '22023'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'fecha requerida' USING ERRCODE = '22023'; END IF;
  IF COALESCE(p_esta_pago, false) AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para crear un arreglo ya cobrado' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_esta_pago, false) AND p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    v_evento_id := public._finanzas_evento_idempotente(
      v_tenant_id, p_idempotency_key, 'COBRO_ARREGLO'
    );
    IF v_evento_id IS NOT NULL THEN
      SELECT e.arreglo_id INTO v_arreglo_id
      FROM public.eventos_financieros AS e
      WHERE e.id = v_evento_id;
      IF v_arreglo_id IS NULL THEN
        RAISE EXCEPTION 'La idempotency_key no tiene arreglo asociado' USING ERRCODE = '55000';
      END IF;
      RETURN v_arreglo_id;
    END IF;
  END IF;

  p_detalles := COALESCE(p_detalles, '[]'::jsonb);
  p_repuestos := COALESCE(p_repuestos, '[]'::jsonb);
  p_repuestos_nuevos := COALESCE(p_repuestos_nuevos, '[]'::jsonb);
  IF jsonb_typeof(p_detalles) <> 'array' THEN RAISE EXCEPTION 'detalles debe ser array' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_repuestos) <> 'array' THEN RAISE EXCEPTION 'repuestos debe ser array' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_repuestos_nuevos) <> 'array' THEN RAISE EXCEPTION 'repuestos_nuevos debe ser array' USING ERRCODE = '22023'; END IF;

  PERFORM public._check_codigos_unicos_en_array(p_repuestos_nuevos);
  IF p_cuenta_id IS NOT NULL THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);
  END IF;

  -- Se inserta inicialmente no cobrado para que el cobro sea un único evento
  -- financiero atómico y sea quien fije esta_pago=true.
  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id,
    p_taller_id := p_taller_id,
    p_estado := p_estado,
    p_descripcion := p_descripcion,
    p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha,
    p_observaciones := p_observaciones,
    p_precio_final := p_precio_final,
    p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := false,
    p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(
    v_arreglo_id, p_taller_id, p_repuestos, p_cuenta_id
  );
  PERFORM public._crear_repuestos_nuevos_para_arreglo(
    v_arreglo_id, p_taller_id, p_repuestos_nuevos, p_cuenta_id
  );

  UPDATE public.arreglos
  SET precio_final = COALESCE(p_precio_final, precio_final),
      precio_sin_iva = COALESCE(p_precio_sin_iva, precio_sin_iva),
      updated_at = now()
  WHERE id = v_arreglo_id AND tenant_id = v_tenant_id;

  IF COALESCE(p_esta_pago, false) THEN
    PERFORM public.rpc_finanzas_cobrar_arreglo(
      v_arreglo_id,
      p_cuenta_id,
      COALESCE(p_fecha_cobro, p_fecha),
      p_idempotency_key
    );
  END IF;

  RETURN v_arreglo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._asignar_repuestos_existentes_a_arreglo(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._crear_repuestos_nuevos_para_arreglo(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamptz, uuid) TO authenticated, service_role;
