-- B2C-XXX: Simplificar arquitectura financiera.
-- Ver implementation_plan.md para decisiones de diseño.

-- ===========================================================================
-- 1. Extender movimientos_financieros con los campos del evento
-- ===========================================================================

ALTER TABLE public.movimientos_financieros
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS fecha timestamptz,
  ADD COLUMN IF NOT EXISTS arreglo_id uuid REFERENCES public.arreglos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operacion_id uuid REFERENCES public.operaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversa_movimiento_id uuid REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grupo_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_tipo_check CHECK (
    tipo IS NULL OR tipo IN (
      'APERTURA_CUENTA','TRANSFERENCIA','GASTO','COBRO_ARREGLO',
      'COMPRA_STOCK','VENTA_STOCK','REVERSO'
    )
  );

ALTER TABLE public.movimientos_financieros
  ADD CONSTRAINT movimientos_financieros_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object');

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_financieros_tenant_idempotency_key
  ON public.movimientos_financieros (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_grupo
  ON public.movimientos_financieros (grupo_id)
  WHERE grupo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_tenant_fecha
  ON public.movimientos_financieros (tenant_id, fecha DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_arreglo_mov
  ON public.movimientos_financieros (arreglo_id)
  WHERE arreglo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_financieros_operacion_mov
  ON public.movimientos_financieros (operacion_id)
  WHERE operacion_id IS NOT NULL;

-- ===========================================================================
-- 2. Migrar datos de eventos_financieros a movimientos_financieros
-- ===========================================================================

UPDATE public.movimientos_financieros AS m
SET
  tipo         = e.tipo,
  fecha        = e.fecha,
  arreglo_id   = e.arreglo_id,
  operacion_id = e.operacion_id,
  metadata     = e.metadata,
  created_by   = e.created_by,
  idempotency_key = e.idempotency_key
FROM public.eventos_financieros AS e
WHERE m.evento_id = e.id;

-- Grupo para transferencias (ambos movimientos del mismo evento)
UPDATE public.movimientos_financieros AS m
SET grupo_id = e.id
FROM public.eventos_financieros AS e
WHERE m.evento_id = e.id
  AND e.tipo = 'TRANSFERENCIA';

-- reversa_movimiento_id: para cada movimiento de tipo REVERSO,
-- apuntar al movimiento principal (débito) del evento revertido.
UPDATE public.movimientos_financieros AS m
SET reversa_movimiento_id = origen.id
FROM public.eventos_financieros AS e_reverso
JOIN public.movimientos_financieros AS origen
  ON origen.evento_id = e_reverso.reversa_evento_id
WHERE m.evento_id = e_reverso.id
  AND e_reverso.tipo = 'REVERSO'
  AND e_reverso.reversa_evento_id IS NOT NULL
  AND (
    origen.importe < 0
    OR NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros AS otro
      WHERE otro.evento_id = e_reverso.reversa_evento_id AND otro.importe < 0
    )
  );

-- ===========================================================================
-- 3. Saldo cacheado en cuentas_financieras
-- ===========================================================================

ALTER TABLE public.cuentas_financieras
  ADD COLUMN IF NOT EXISTS saldo numeric(14,2) NOT NULL DEFAULT 0;

-- Backfill desde historial existente
UPDATE public.cuentas_financieras AS c
SET saldo = COALESCE((
  SELECT SUM(m.importe)
  FROM public.movimientos_financieros AS m
  WHERE m.cuenta_financiera_id = c.id
), 0);

-- ===========================================================================
-- 4. Trigger para mantener saldo
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._finanzas_actualizar_saldo_cuenta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cuentas_financieras
    SET saldo = saldo + NEW.importe
    WHERE id = NEW.cuenta_financiera_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS movimientos_financieros_actualizar_saldo ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_actualizar_saldo
  AFTER INSERT ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_actualizar_saldo_cuenta();

-- ===========================================================================
-- 5. Renombrar evento_financiero_actual_id -> movimiento_financiero_id
-- ===========================================================================

ALTER TABLE public.arreglos
  DROP CONSTRAINT IF EXISTS arreglos_evento_financiero_actual_id_fkey;
ALTER TABLE public.arreglos
  RENAME COLUMN evento_financiero_actual_id TO movimiento_financiero_id;

ALTER TABLE public.operaciones
  DROP CONSTRAINT IF EXISTS operaciones_evento_financiero_actual_id_fkey;
ALTER TABLE public.operaciones
  RENAME COLUMN evento_financiero_actual_id TO movimiento_financiero_id;

-- Actualizar FK en arreglos al movimiento principal
UPDATE public.arreglos AS a
SET movimiento_financiero_id = (
  SELECT m.id
  FROM public.movimientos_financieros AS m
  JOIN public.eventos_financieros AS e ON e.id = m.evento_id
  WHERE e.id = a.movimiento_financiero_id
    AND (m.importe < 0 OR NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros m2
      WHERE m2.evento_id = e.id AND m2.importe < 0
    ))
  LIMIT 1
)
WHERE a.movimiento_financiero_id IS NOT NULL;

-- Actualizar FK en operaciones al movimiento principal
UPDATE public.operaciones AS o
SET movimiento_financiero_id = (
  SELECT m.id
  FROM public.movimientos_financieros AS m
  JOIN public.eventos_financieros AS e ON e.id = m.evento_id
  WHERE e.id = o.movimiento_financiero_id
    AND (m.importe < 0 OR NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros m2
      WHERE m2.evento_id = e.id AND m2.importe < 0
    ))
  LIMIT 1
)
WHERE o.movimiento_financiero_id IS NOT NULL;

DROP INDEX IF EXISTS idx_arreglos_evento_financiero_actual;
DROP INDEX IF EXISTS idx_operaciones_evento_financiero_actual;

ALTER TABLE public.arreglos
  ADD CONSTRAINT arreglos_movimiento_financiero_id_fkey
  FOREIGN KEY (movimiento_financiero_id) REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_movimiento_financiero_id_fkey
  FOREIGN KEY (movimiento_financiero_id) REFERENCES public.movimientos_financieros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_arreglos_movimiento_financiero
  ON public.arreglos (movimiento_financiero_id)
  WHERE movimiento_financiero_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_movimiento_financiero
  ON public.operaciones (movimiento_financiero_id)
  WHERE movimiento_financiero_id IS NOT NULL;

-- ===========================================================================
-- 6. Eliminar tabla eventos_financieros y sus dependencias
-- ===========================================================================

ALTER TABLE public.movimientos_financieros DROP COLUMN IF EXISTS evento_id;

DROP TRIGGER IF EXISTS eventos_financieros_validar_tenant ON public.eventos_financieros;
DROP TRIGGER IF EXISTS eventos_financieros_inmutables ON public.eventos_financieros;
DROP TRIGGER IF EXISTS arreglos_validar_evento_financiero_actual ON public.arreglos;
DROP TRIGGER IF EXISTS operaciones_validar_evento_financiero_actual ON public.operaciones;

DROP TRIGGER IF EXISTS movimientos_financieros_validar_tenant ON public.movimientos_financieros;
DROP FUNCTION IF EXISTS public._finanzas_validar_evento_tenant();
DROP FUNCTION IF EXISTS public._finanzas_validar_movimiento_tenant();
DROP FUNCTION IF EXISTS public._finanzas_validar_link_evento();
DROP FUNCTION IF EXISTS public._finanzas_insertar_evento(uuid, text, timestamptz, text, uuid, uuid, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public._finanzas_insertar_movimiento(uuid, uuid, uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public._finanzas_evento_idempotente(uuid, uuid, text);
DROP FUNCTION IF EXISTS public._finanzas_reversar_evento(uuid, timestamptz, text, uuid);
DROP FUNCTION IF EXISTS public.eliminar_tenant(uuid);

DROP TABLE IF EXISTS public.eventos_financieros;

-- ===========================================================================
-- 7. Inmutabilidad del ledger
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._finanzas_bloquear_mutacion_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos financieros son inmutables. Use un movimiento de reverso.'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS movimientos_financieros_inmutables ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_inmutables
  BEFORE UPDATE OR DELETE ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_bloquear_mutacion_ledger();

-- Validación de tenant (simplificada, sin evento)
CREATE OR REPLACE FUNCTION public._finanzas_validar_movimiento_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cuenta_tenant uuid;
BEGIN
  SELECT c.tenant_id INTO v_cuenta_tenant
  FROM public.cuentas_financieras AS c
  WHERE c.id = NEW.cuenta_financiera_id;

  IF v_cuenta_tenant IS NULL OR v_cuenta_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'La cuenta financiera no pertenece al tenant del movimiento'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movimientos_financieros_validar_tenant ON public.movimientos_financieros;
CREATE TRIGGER movimientos_financieros_validar_tenant
  BEFORE INSERT ON public.movimientos_financieros
  FOR EACH ROW EXECUTE FUNCTION public._finanzas_validar_movimiento_tenant();

-- ===========================================================================
-- 8. Funciones helper internas
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._finanzas_movimiento_idempotente(
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
  v_movimiento_id uuid;
  v_tipo text;
BEGIN
  IF p_idempotency_key IS NULL THEN RETURN NULL; END IF;

  SELECT m.id, m.tipo INTO v_movimiento_id, v_tipo
  FROM public.movimientos_financieros AS m
  WHERE m.tenant_id = p_tenant_id AND m.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_tipo <> p_tipo_esperado THEN
    RAISE EXCEPTION 'La idempotency_key ya fue usada para un movimiento %', v_tipo
      USING ERRCODE = '23505';
  END IF;

  RETURN v_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_insertar_movimiento(
  p_tenant_id uuid,
  p_tipo text,
  p_cuenta_id uuid,
  p_importe numeric,
  p_fecha timestamptz DEFAULT now(),
  p_descripcion text DEFAULT NULL,
  p_categoria_gasto text DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL,
  p_operacion_id uuid DEFAULT NULL,
  p_reversa_movimiento_id uuid DEFAULT NULL,
  p_grupo_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
    RAISE EXCEPTION 'importe financiero debe ser distinto de cero' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.movimientos_financieros (
    tenant_id, tipo, cuenta_financiera_id, importe, fecha, descripcion,
    categoria_gasto, arreglo_id, operacion_id, reversa_movimiento_id,
    grupo_id, idempotency_key, metadata, created_by
  ) VALUES (
    p_tenant_id, p_tipo, p_cuenta_id, p_importe, COALESCE(p_fecha, now()),
    nullif(btrim(p_descripcion), ''), p_categoria_gasto, p_arreglo_id, p_operacion_id,
    p_reversa_movimiento_id, p_grupo_id, p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb), auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  RETURN v_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._finanzas_reversar_movimiento(
  p_movimiento_id uuid,
  p_grupo_id uuid,
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
  v_reversa_id uuid;
  v_first_reversa_id uuid;
  v_nuevo_grupo_id uuid;
  v_movimiento record;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000';
  END IF;
  IF p_movimiento_id IS NULL AND p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere movimiento_id o grupo_id' USING ERRCODE = '22023';
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(
    v_tenant_id, p_idempotency_key, 'REVERSO'
  );
  IF v_existente_id IS NOT NULL THEN RETURN v_existente_id; END IF;

  IF p_movimiento_id IS NOT NULL THEN
    PERFORM 1
    FROM public.movimientos_financieros AS m
    WHERE m.reversa_movimiento_id = p_movimiento_id AND m.tipo = 'REVERSO';
    IF FOUND THEN
      RAISE EXCEPTION 'El movimiento financiero % ya fue revertido', p_movimiento_id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  v_nuevo_grupo_id := gen_random_uuid();

  FOR v_movimiento IN
    SELECT m.id, m.tipo, m.cuenta_financiera_id, m.importe,
           m.categoria_gasto, m.descripcion, m.arreglo_id, m.operacion_id
    FROM public.movimientos_financieros AS m
    WHERE m.tenant_id = v_tenant_id
      AND (
        (p_movimiento_id IS NOT NULL AND m.id = p_movimiento_id)
        OR
        (p_grupo_id IS NOT NULL AND m.grupo_id = p_grupo_id AND m.tipo <> 'REVERSO')
      )
    ORDER BY m.created_at, m.id
    FOR UPDATE
  LOOP
    IF v_movimiento.tipo = 'REVERSO' THEN
      RAISE EXCEPTION 'No se puede revertir un movimiento de tipo REVERSO'
        USING ERRCODE = '55000';
    END IF;

    PERFORM public._finanzas_exigir_cuenta(
      v_movimiento.cuenta_financiera_id, v_tenant_id, false
    );

    v_reversa_id := public._finanzas_insertar_movimiento(
      p_tenant_id             := v_tenant_id,
      p_tipo                  := 'REVERSO',
      p_cuenta_id             := v_movimiento.cuenta_financiera_id,
      p_importe               := -v_movimiento.importe,
      p_fecha                 := COALESCE(p_fecha, now()),
      p_descripcion           := COALESCE(nullif(btrim(p_descripcion), ''), 'Reverso de movimiento financiero'),
      p_categoria_gasto       := v_movimiento.categoria_gasto,
      p_arreglo_id            := v_movimiento.arreglo_id,
      p_operacion_id          := v_movimiento.operacion_id,
      p_reversa_movimiento_id := v_movimiento.id,
      p_grupo_id              := v_nuevo_grupo_id,
      p_idempotency_key       := CASE WHEN v_first_reversa_id IS NULL THEN p_idempotency_key ELSE NULL END,
      p_metadata              := jsonb_build_object(
        'tipo_revertido', v_movimiento.tipo,
        'movimiento_revertido_id', v_movimiento.id
      )
    );

    IF v_first_reversa_id IS NULL THEN
      v_first_reversa_id := v_reversa_id;
    END IF;
  END LOOP;

  IF v_first_reversa_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron movimientos para revertir' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_first_reversa_id;
END;
$$;

REVOKE ALL ON FUNCTION public._finanzas_movimiento_idempotente(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_insertar_movimiento(uuid, text, uuid, numeric, timestamptz, text, text, uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_reversar_movimiento(uuid, uuid, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_actualizar_saldo_cuenta() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_bloquear_mutacion_ledger() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._finanzas_validar_movimiento_tenant() FROM PUBLIC, anon, authenticated, service_role;

-- ===========================================================================
-- 9. RPCs: Cuentas financieras y saldo
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_cuentas();
CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_cuentas()
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
    COALESCE(SUM(m.importe) FILTER (WHERE m.tipo = 'APERTURA_CUENTA'), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.movimientos_financieros AS m
    ON m.cuenta_financiera_id = c.id AND m.tipo = 'APERTURA_CUENTA'
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, lower(c.nombre), c.created_at;
$$;

DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_cuenta(uuid);
CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_cuenta(p_cuenta_id uuid)
RETURNS TABLE (
  id uuid, tenant_id uuid, nombre text, tipo text, activo boolean,
  saldo_inicial numeric, saldo_actual numeric, saldo numeric,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    c.id, c.tenant_id, c.nombre, c.tipo, c.activo,
    COALESCE(SUM(m.importe) FILTER (WHERE m.tipo = 'APERTURA_CUENTA'), 0)::numeric AS saldo_inicial,
    c.saldo AS saldo_actual,
    c.saldo AS saldo,
    c.created_at, c.updated_at
  FROM public.cuentas_financieras AS c
  LEFT JOIN public.movimientos_financieros AS m
    ON m.cuenta_financiera_id = c.id AND m.tipo = 'APERTURA_CUENTA'
  WHERE c.id = p_cuenta_id AND c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_crear_cuenta(
  p_nombre text, p_tipo text,
  p_saldo_inicial numeric DEFAULT 0,
  p_fecha timestamptz DEFAULT now(),
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_nombre text := nullif(btrim(p_nombre), '');
  v_tipo text := upper(btrim(coalesce(p_tipo, '')));
  v_cuenta_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF v_nombre IS NULL THEN RAISE EXCEPTION 'nombre de cuenta requerido' USING ERRCODE = '22023'; END IF;
  IF v_tipo NOT IN ('EFECTIVO','CUENTA_BANCARIA','BILLETERA_DIGITAL','TARJETA_CREDITO') THEN
    RAISE EXCEPTION 'tipo de cuenta inválido (%)', p_tipo USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'APERTURA_CUENTA');
  IF v_existente_id IS NOT NULL THEN
    SELECT m.cuenta_financiera_id INTO v_cuenta_id
    FROM public.movimientos_financieros AS m WHERE m.id = v_existente_id;
    RETURN v_cuenta_id;
  END IF;

  INSERT INTO public.cuentas_financieras (tenant_id, nombre, tipo)
  VALUES (v_tenant_id, v_nombre, v_tipo)
  RETURNING id INTO v_cuenta_id;

  IF COALESCE(p_saldo_inicial, 0) <> 0 THEN
    PERFORM public._finanzas_insertar_movimiento(
      p_tenant_id := v_tenant_id, p_tipo := 'APERTURA_CUENTA',
      p_cuenta_id := v_cuenta_id, p_importe := p_saldo_inicial,
      p_fecha := COALESCE(p_fecha, now()), p_descripcion := 'Saldo inicial',
      p_idempotency_key := p_idempotency_key,
      p_metadata := jsonb_build_object('cuenta_financiera_id', v_cuenta_id)
    );
  END IF;

  RETURN v_cuenta_id;
END;
$$;

-- ===========================================================================
-- 10. RPC listar movimientos
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_movimientos(uuid, timestamptz, timestamptz, int, int);
CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_movimientos(
  p_cuenta_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, tipo text, fecha timestamptz, created_at timestamptz,
  cuenta_financiera_id uuid, importe numeric, categoria_gasto text,
  descripcion text, arreglo_id uuid, operacion_id uuid,
  reversa_movimiento_id uuid, grupo_id uuid
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT m.id, m.tipo, m.fecha, m.created_at, m.cuenta_financiera_id,
         m.importe, m.categoria_gasto, m.descripcion, m.arreglo_id,
         m.operacion_id, m.reversa_movimiento_id, m.grupo_id
  FROM public.movimientos_financieros AS m
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- ===========================================================================
-- 11. Transferencias
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_transferir(
  p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_importe numeric,
  p_fecha timestamptz DEFAULT now(), p_descripcion text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_existente_id uuid;
  v_grupo_id uuid;
  v_descripcion text := COALESCE(nullif(btrim(p_descripcion), ''), 'Transferencia entre cuentas');
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
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

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'TRANSFERENCIA');
  IF v_existente_id IS NOT NULL THEN RETURN v_existente_id; END IF;

  IF p_cuenta_origen_id::text < p_cuenta_destino_id::text THEN
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
  ELSE
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_destino_id, v_tenant_id, true);
    PERFORM public._finanzas_exigir_cuenta(p_cuenta_origen_id, v_tenant_id, true);
  END IF;

  v_grupo_id := gen_random_uuid();

  v_existente_id := public._finanzas_insertar_movimiento(
    p_tenant_id := v_tenant_id, p_tipo := 'TRANSFERENCIA',
    p_cuenta_id := p_cuenta_origen_id, p_importe := -p_importe,
    p_fecha := COALESCE(p_fecha, now()), p_descripcion := v_descripcion,
    p_grupo_id := v_grupo_id, p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('cuenta_origen_id', p_cuenta_origen_id, 'cuenta_destino_id', p_cuenta_destino_id)
  );

  PERFORM public._finanzas_insertar_movimiento(
    p_tenant_id := v_tenant_id, p_tipo := 'TRANSFERENCIA',
    p_cuenta_id := p_cuenta_destino_id, p_importe := p_importe,
    p_fecha := COALESCE(p_fecha, now()), p_descripcion := v_descripcion,
    p_grupo_id := v_grupo_id,
    p_metadata := jsonb_build_object('cuenta_origen_id', p_cuenta_origen_id, 'cuenta_destino_id', p_cuenta_destino_id)
  );

  RETURN v_existente_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_transferencia(uuid);
CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_transferencia(p_transferencia_id uuid)
RETURNS TABLE (
  transferencia_id uuid, fecha timestamptz, created_at timestamptz, descripcion text,
  cuenta_origen_id uuid, cuenta_origen_nombre text,
  cuenta_destino_id uuid, cuenta_destino_nombre text,
  importe numeric, reversa_movimiento_id uuid
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    mo.id AS transferencia_id, mo.fecha, mo.created_at, mo.descripcion,
    mo.cuenta_financiera_id AS cuenta_origen_id, co.nombre AS cuenta_origen_nombre,
    md.cuenta_financiera_id AS cuenta_destino_id, cd.nombre AS cuenta_destino_nombre,
    abs(mo.importe)::numeric AS importe,
    mo.reversa_movimiento_id
  FROM public.movimientos_financieros AS mo
  JOIN public.movimientos_financieros AS md
    ON md.grupo_id = mo.grupo_id AND md.importe > 0
  JOIN public.cuentas_financieras AS co ON co.id = mo.cuenta_financiera_id
  JOIN public.cuentas_financieras AS cd ON cd.id = md.cuenta_financiera_id
  WHERE mo.id = p_transferencia_id
    AND mo.tipo = 'TRANSFERENCIA' AND mo.importe < 0
    AND mo.tenant_id = (SELECT public.current_tenant_id());
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_transferencia(
  p_transferencia_id uuid, p_cuenta_origen_id uuid, p_cuenta_destino_id uuid,
  p_importe numeric, p_fecha timestamptz, p_descripcion text,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_grupo_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'TRANSFERENCIA');
  IF v_existente_id IS NOT NULL THEN RETURN v_existente_id; END IF;

  SELECT m.tipo, m.grupo_id INTO v_tipo, v_grupo_id
  FROM public.movimientos_financieros AS m
  WHERE m.id = p_transferencia_id AND m.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Transferencia no encontrada (%)', p_transferencia_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'TRANSFERENCIA' THEN
    RAISE EXCEPTION 'El movimiento % no es una transferencia', p_transferencia_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_reversar_movimiento(
    NULL, v_grupo_id, COALESCE(p_fecha, now()), 'Reverso por actualización de transferencia', NULL
  );

  RETURN public.rpc_finanzas_transferir(
    p_cuenta_origen_id, p_cuenta_destino_id, p_importe,
    COALESCE(p_fecha, now()), p_descripcion, p_idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_transferencia(
  p_transferencia_id uuid, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_grupo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  SELECT m.tipo, m.grupo_id INTO v_tipo, v_grupo_id
  FROM public.movimientos_financieros AS m
  WHERE m.id = p_transferencia_id AND m.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Transferencia no encontrada (%)', p_transferencia_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'TRANSFERENCIA' THEN
    RAISE EXCEPTION 'El movimiento % no es una transferencia', p_transferencia_id USING ERRCODE = '22023';
  END IF;

  RETURN public._finanzas_reversar_movimiento(NULL, v_grupo_id, now(), 'Anulación de transferencia', p_idempotency_key);
END;
$$;

-- ===========================================================================
-- 12. Gastos financieros
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_registrar_gasto(
  p_cuenta_id uuid, p_categoria text, p_importe numeric, p_descripcion text,
  p_fecha timestamptz DEFAULT now(), p_idempotency_key uuid DEFAULT NULL,
  p_arreglo_id uuid DEFAULT NULL, p_operacion_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_categoria text := upper(btrim(coalesce(p_categoria, '')));
  v_descripcion text := nullif(btrim(p_descripcion), '');
  v_movimiento_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN
    RAISE EXCEPTION 'importe debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;
  IF v_descripcion IS NULL THEN
    RAISE EXCEPTION 'descripción de gasto requerida' USING ERRCODE = '22023';
  END IF;
  IF v_categoria NOT IN (
    'ALQUILER','SERVICIOS','SUELDOS_HONORARIOS','IMPUESTOS',
    'INSUMOS_REPUESTOS','HERRAMIENTAS_EQUIPAMIENTO','MANTENIMIENTO',
    'SEGUROS','TRANSPORTE_COMBUSTIBLE','MARKETING_PUBLICIDAD',
    'COMISIONES_GASTOS_BANCARIOS','OTROS'
  ) THEN
    RAISE EXCEPTION 'categoría de gasto inválida (%)', p_categoria USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'GASTO');
  IF v_existente_id IS NOT NULL THEN RETURN v_existente_id; END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  v_movimiento_id := public._finanzas_insertar_movimiento(
    p_tenant_id := v_tenant_id, p_tipo := 'GASTO',
    p_cuenta_id := p_cuenta_id, p_importe := -p_importe,
    p_fecha := COALESCE(p_fecha, now()), p_descripcion := v_descripcion,
    p_categoria_gasto := v_categoria, p_arreglo_id := p_arreglo_id,
    p_operacion_id := p_operacion_id, p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('categoria_gasto', v_categoria)
  );

  IF p_arreglo_id IS NOT NULL THEN
    UPDATE public.arreglos SET movimiento_financiero_id = v_movimiento_id
    WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  END IF;
  IF p_operacion_id IS NOT NULL THEN
    UPDATE public.operaciones SET movimiento_financiero_id = v_movimiento_id
    WHERE id = p_operacion_id AND tenant_id = v_tenant_id;
  END IF;

  RETURN v_movimiento_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_finanzas_listar_gastos(timestamptz, timestamptz, int, int);
CREATE OR REPLACE FUNCTION public.rpc_finanzas_listar_gastos(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS TABLE (
  gasto_id uuid, fecha timestamptz, created_at timestamptz,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text,
  categoria_gasto text, descripcion text, importe numeric, reversa_movimiento_id uuid
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    m.id AS gasto_id, m.fecha, m.created_at, m.cuenta_financiera_id,
    c.nombre AS cuenta_financiera_nombre, m.categoria_gasto, m.descripcion,
    abs(m.importe)::numeric AS importe, m.reversa_movimiento_id
  FROM public.movimientos_financieros AS m
  JOIN public.cuentas_financieras AS c ON c.id = m.cuenta_financiera_id
  WHERE m.tipo = 'GASTO'
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND m.reversa_movimiento_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id
    )
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

DROP FUNCTION IF EXISTS public.rpc_finanzas_obtener_gasto(uuid);
CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_gasto(p_gasto_id uuid)
RETURNS TABLE (
  gasto_id uuid, fecha timestamptz, created_at timestamptz,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text,
  categoria_gasto text, descripcion text, importe numeric, reversa_movimiento_id uuid
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT * FROM public.rpc_finanzas_listar_gastos(NULL, NULL, 500, 0)
  WHERE gasto_id = p_gasto_id;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_gasto(
  p_gasto_id uuid, p_cuenta_id uuid, p_categoria text, p_importe numeric,
  p_descripcion text, p_fecha timestamptz, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
  v_arreglo_id uuid;
  v_operacion_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'GASTO');
  IF v_existente_id IS NOT NULL THEN RETURN v_existente_id; END IF;

  SELECT m.tipo, m.arreglo_id, m.operacion_id
  INTO v_tipo, v_arreglo_id, v_operacion_id
  FROM public.movimientos_financieros AS m
  WHERE m.id = p_gasto_id AND m.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Gasto no encontrado (%)', p_gasto_id USING ERRCODE = 'P0002';
  END IF;
  IF v_tipo <> 'GASTO' THEN
    RAISE EXCEPTION 'El movimiento % no es un gasto', p_gasto_id USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_reversar_movimiento(
    p_gasto_id, NULL, COALESCE(p_fecha, now()), 'Reverso por actualización de gasto', NULL
  );

  RETURN public.rpc_finanzas_registrar_gasto(
    p_cuenta_id, p_categoria, p_importe, p_descripcion,
    COALESCE(p_fecha, now()), p_idempotency_key, v_arreglo_id, v_operacion_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_eliminar_gasto(
  p_gasto_id uuid, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo text;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  SELECT m.tipo INTO v_tipo FROM public.movimientos_financieros AS m
  WHERE m.id = p_gasto_id AND m.tenant_id = v_tenant_id;

  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Gasto no encontrado (%)', p_gasto_id USING ERRCODE = 'P0002'; END IF;
  IF v_tipo <> 'GASTO' THEN RAISE EXCEPTION 'El movimiento % no es un gasto', p_gasto_id USING ERRCODE = '22023'; END IF;

  RETURN public._finanzas_reversar_movimiento(p_gasto_id, NULL, now(), 'Anulación de gasto', p_idempotency_key);
END;
$$;

-- ===========================================================================
-- 13. Cobro / anulación cobro arreglo
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_finanzas_cobrar_arreglo(
  p_arreglo_id uuid, p_cuenta_id uuid, p_fecha_cobro timestamptz,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_precio_final numeric;
  v_esta_pago boolean;
  v_movimiento_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'COBRO_ARREGLO');
  IF v_existente_id IS NOT NULL THEN
    PERFORM 1 FROM public.movimientos_financieros AS m
    WHERE m.id = v_existente_id AND m.arreglo_id = p_arreglo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La idempotency_key corresponde a otro arreglo' USING ERRCODE = '23505';
    END IF;
    RETURN v_existente_id;
  END IF;

  SELECT a.precio_final, a.esta_pago INTO v_precio_final, v_esta_pago
  FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002'; END IF;
  IF COALESCE(v_esta_pago, false) THEN RAISE EXCEPTION 'El arreglo ya se encuentra cobrado' USING ERRCODE = '55000'; END IF;
  IF COALESCE(v_precio_final, 0) <= 0 THEN
    RAISE EXCEPTION 'El arreglo debe tener precio_final mayor a cero para cobrarlo' USING ERRCODE = '22023';
  END IF;

  PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true);

  v_movimiento_id := public._finanzas_insertar_movimiento(
    p_tenant_id := v_tenant_id, p_tipo := 'COBRO_ARREGLO',
    p_cuenta_id := p_cuenta_id, p_importe := v_precio_final,
    p_fecha := COALESCE(p_fecha_cobro, now()),
    p_descripcion := 'Cobro de arreglo ' || p_arreglo_id::text,
    p_arreglo_id := p_arreglo_id, p_idempotency_key := p_idempotency_key,
    p_metadata := jsonb_build_object('precio_final', v_precio_final)
  );

  UPDATE public.arreglos
  SET esta_pago = true, movimiento_financiero_id = v_movimiento_id
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  RETURN v_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finanzas_anular_cobro_arreglo(
  p_arreglo_id uuid, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_esta_pago boolean;
  v_cobro_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido' USING ERRCODE = '22023'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'REVERSO');
  IF v_existente_id IS NOT NULL THEN
    PERFORM 1 FROM public.movimientos_financieros AS m
    WHERE m.id = v_existente_id AND m.arreglo_id = p_arreglo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La idempotency_key corresponde a otro arreglo' USING ERRCODE = '23505';
    END IF;
    RETURN v_existente_id;
  END IF;

  SELECT a.esta_pago INTO v_esta_pago FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002'; END IF;
  IF NOT COALESCE(v_esta_pago, false) THEN RAISE EXCEPTION 'El arreglo no está cobrado' USING ERRCODE = '55000'; END IF;

  SELECT m.id INTO v_cobro_id
  FROM public.movimientos_financieros AS m
  WHERE m.tenant_id = v_tenant_id AND m.arreglo_id = p_arreglo_id AND m.tipo = 'COBRO_ARREGLO'
    AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT 1 FOR UPDATE;

  IF v_cobro_id IS NULL THEN
    RAISE EXCEPTION 'No existe un cobro financiero vigente para el arreglo' USING ERRCODE = 'P0002';
  END IF;

  v_existente_id := public._finanzas_reversar_movimiento(
    v_cobro_id, NULL, now(), 'Anulación de cobro de arreglo', p_idempotency_key
  );

  UPDATE public.arreglos
  SET esta_pago = false, movimiento_financiero_id = v_existente_id
  WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;

  RETURN v_existente_id;
END;
$$;

-- ===========================================================================
-- 14. Operaciones de stock
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_crear_operacion_con_stock(
  p_tipo public.tipo_operacion, p_taller_id uuid, p_lineas jsonb,
  p_arreglo_id uuid DEFAULT NULL, p_fecha timestamptz DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_movimiento_id uuid;
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
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_tipo IS NULL OR p_tipo::text = 'GASTO' THEN
    RAISE EXCEPTION 'GASTO debe registrarse con rpc_finanzas_registrar_gasto' USING ERRCODE = '22023';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'lineas debe ser un array no vacío' USING ERRCODE = '22023';
  END IF;

  v_financial_tipo := CASE p_tipo
    WHEN 'COMPRA'::public.tipo_operacion THEN 'COMPRA_STOCK'
    WHEN 'VENTA'::public.tipo_operacion THEN 'VENTA_STOCK'
    ELSE NULL
  END;

  IF v_financial_tipo IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para COMPRA o VENTA' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND v_financial_tipo IS NULL THEN
    RAISE EXCEPTION 'Solo COMPRA y VENTA pueden impactar una cuenta financiera' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requiere cuenta_id para una operación financiera' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, v_financial_tipo);
    IF v_existente_id IS NOT NULL THEN
      SELECT m.operacion_id INTO v_operacion_id FROM public.movimientos_financieros AS m WHERE m.id = v_existente_id;
      IF v_operacion_id IS NULL THEN
        RAISE EXCEPTION 'La idempotency_key no tiene una operación de stock asociada' USING ERRCODE = '55000';
      END IF;
      RETURN v_operacion_id;
    END IF;
  END IF;

  PERFORM 1 FROM public.talleres AS t WHERE t.id = p_taller_id AND t.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Taller no encontrado o fuera del tenant (%)', p_taller_id USING ERRCODE = 'P0002'; END IF;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO' USING ERRCODE = '22023'; END IF;
    PERFORM 1 FROM public.arreglos AS a
    WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id AND a.taller_id = p_taller_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado para el taller indicado' USING ERRCODE = 'P0002'; END IF;
  ELSIF p_arreglo_id IS NOT NULL THEN
    RAISE EXCEPTION 'arreglo_id solo es válido para ASIGNACION_ARREGLO' USING ERRCODE = '22023';
  END IF;

  v_expected_ids := (SELECT COUNT(DISTINCT (linea->>'stock_id')::uuid) FROM jsonb_array_elements(p_lineas) AS linea);
  v_found_ids := (
    SELECT COUNT(*) FROM public.stocks AS s
    WHERE s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
      AND s.id IN (SELECT DISTINCT (linea->>'stock_id')::uuid FROM jsonb_array_elements(p_lineas) AS linea)
  );
  IF v_expected_ids <> v_found_ids THEN
    RAISE EXCEPTION 'Algún stock_id no existe o no pertenece al taller' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.stocks AS s
  WHERE s.tenant_id = v_tenant_id AND s.taller_id = p_taller_id
    AND s.id IN (SELECT DISTINCT (linea->>'stock_id')::uuid FROM jsonb_array_elements(p_lineas) AS linea)
  ORDER BY s.id FOR UPDATE;

  IF p_cuenta_id IS NOT NULL THEN PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true); END IF;

  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (v_tenant_id, p_tipo, p_taller_id, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id) VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
    v_stock_id := (v_linea->>'stock_id')::uuid;
    v_cantidad := (v_linea->>'cantidad')::int;
    v_monto := COALESCE((v_linea->>'monto_unitario')::numeric, 0);

    IF v_stock_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Línea inválida (stock_id %, cantidad %)', v_stock_id, v_cantidad USING ERRCODE = '22023';
    END IF;
    IF v_monto < 0 THEN RAISE EXCEPTION 'monto_unitario no puede ser negativo' USING ERRCODE = '22023'; END IF;

    v_delta := CASE p_tipo
      WHEN 'COMPRA'::public.tipo_operacion THEN v_cantidad
      WHEN 'VENTA'::public.tipo_operacion THEN -v_cantidad
      WHEN 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN -v_cantidad
      WHEN 'AJUSTE'::public.tipo_operacion THEN COALESCE((v_linea->>'delta_cantidad')::int, v_cantidad)
      ELSE 0
    END;
    IF v_delta = 0 THEN RAISE EXCEPTION 'delta inválido para stock %', v_stock_id USING ERRCODE = '22023'; END IF;

    INSERT INTO public.operaciones_lineas (operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad)
    VALUES (v_operacion_id, v_stock_id, v_cantidad, v_monto, v_delta);

    IF v_delta < 0 THEN
      UPDATE public.stocks AS s SET cantidad = s.cantidad + v_delta, updated_at = now()
      WHERE s.id = v_stock_id AND s.tenant_id = v_tenant_id AND s.cantidad >= -v_delta;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_stock_id USING ERRCODE = 'P0001'; END IF;
    ELSE
      UPDATE public.stocks AS s SET cantidad = s.cantidad + v_delta, updated_at = now()
      WHERE s.id = v_stock_id AND s.tenant_id = v_tenant_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN RAISE EXCEPTION 'stock no encontrado (%)', v_stock_id USING ERRCODE = 'P0002'; END IF;
    END IF;

    v_total := v_total + (v_cantidad * v_monto);
  END LOOP;

  IF p_cuenta_id IS NOT NULL THEN
    IF v_total <= 0 THEN
      RAISE EXCEPTION 'La operación financiera debe tener importe mayor a cero' USING ERRCODE = '22023';
    END IF;

    v_movimiento_id := public._finanzas_insertar_movimiento(
      p_tenant_id := v_tenant_id, p_tipo := v_financial_tipo, p_cuenta_id := p_cuenta_id,
      p_importe := CASE WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN -v_total ELSE v_total END,
      p_fecha := COALESCE(p_fecha, now()),
      p_descripcion := CASE WHEN p_tipo = 'COMPRA'::public.tipo_operacion THEN 'Compra de stock' ELSE 'Venta de stock' END,
      p_operacion_id := v_operacion_id, p_idempotency_key := p_idempotency_key,
      p_metadata := jsonb_build_object('tipo_operacion', p_tipo::text, 'importe_operacion', v_total)
    );

    UPDATE public.operaciones SET movimiento_financiero_id = v_movimiento_id
    WHERE id = v_operacion_id AND tenant_id = v_tenant_id;
  END IF;

  RETURN v_operacion_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid);
DROP FUNCTION IF EXISTS public.rpc_borrar_operacion_con_stock(uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_borrar_operacion_con_stock(
  p_operacion_id uuid, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_operacion_id uuid;
  v_movimiento_id uuid;
  v_existente_id uuid;
  v_linea record;
  v_reverse int;
  v_rowcount int;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;
  IF p_operacion_id IS NULL THEN RAISE EXCEPTION 'operacion_id requerido' USING ERRCODE = '22023'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
    v_existente_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'REVERSO');
    IF v_existente_id IS NOT NULL THEN
      PERFORM 1 FROM public.movimientos_financieros AS m
      WHERE m.id = v_existente_id AND m.operacion_id = p_operacion_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La idempotency_key corresponde a otra operación' USING ERRCODE = '23505';
      END IF;
      RETURN p_operacion_id;
    END IF;
  END IF;

  SELECT o.id INTO v_operacion_id FROM public.operaciones AS o
  WHERE o.id = p_operacion_id AND o.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operación no encontrada (%)', p_operacion_id USING ERRCODE = 'P0002'; END IF;

  SELECT m.id INTO v_movimiento_id
  FROM public.movimientos_financieros AS m
  WHERE m.tenant_id = v_tenant_id AND m.operacion_id = v_operacion_id
    AND m.tipo IN ('COMPRA_STOCK','VENTA_STOCK')
    AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT 1 FOR UPDATE;

  IF v_movimiento_id IS NOT NULL THEN
    PERFORM public._finanzas_reversar_movimiento(
      v_movimiento_id, NULL, now(), 'Anulación de operación de stock', p_idempotency_key
    );
  END IF;

  FOR v_linea IN
    SELECT l.stock_id, l.delta_cantidad FROM public.operaciones_lineas AS l
    WHERE l.operacion_id = v_operacion_id ORDER BY l.stock_id FOR UPDATE
  LOOP
    v_reverse := -v_linea.delta_cantidad;
    IF v_reverse < 0 THEN
      UPDATE public.stocks AS s SET cantidad = s.cantidad + v_reverse, updated_at = now()
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id AND s.cantidad >= -v_reverse;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN RAISE EXCEPTION 'STOCK_INSUFICIENTE (stock %)', v_linea.stock_id USING ERRCODE = 'P0001'; END IF;
    ELSE
      UPDATE public.stocks AS s SET cantidad = s.cantidad + v_reverse, updated_at = now()
      WHERE s.id = v_linea.stock_id AND s.tenant_id = v_tenant_id;
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN RAISE EXCEPTION 'stock no encontrado (%)', v_linea.stock_id USING ERRCODE = 'P0002'; END IF;
    END IF;
  END LOOP;

  DELETE FROM public.operaciones WHERE id = v_operacion_id AND tenant_id = v_tenant_id;
  RETURN v_operacion_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_actualizar_operacion_con_stock(uuid, public.tipo_operacion, uuid, jsonb, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_actualizar_operacion_con_stock(
  p_operacion_id uuid, p_tipo public.tipo_operacion, p_taller_id uuid,
  p_lineas jsonb, p_fecha timestamptz,
  p_cuenta_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_tipo_financiero text;
  v_movimiento_id uuid;
  v_nueva_operacion_id uuid;
  v_arreglo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  v_tipo_financiero := CASE p_tipo
    WHEN 'COMPRA'::public.tipo_operacion THEN 'COMPRA_STOCK'
    WHEN 'VENTA'::public.tipo_operacion THEN 'VENTA_STOCK'
    ELSE NULL
  END;

  IF v_tipo_financiero IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_id requerido para COMPRA o VENTA' USING ERRCODE = '22023';
  END IF;
  IF p_cuenta_id IS NOT NULL AND v_tipo_financiero IS NULL THEN
    RAISE EXCEPTION 'Solo COMPRA y VENTA pueden impactar una cuenta financiera' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NULL THEN
    RAISE EXCEPTION 'idempotency_key requiere cuenta_id para una operacion financiera' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || p_idempotency_key::text));
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_cuenta_id IS NOT NULL THEN
    v_movimiento_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, v_tipo_financiero);
    IF v_movimiento_id IS NOT NULL THEN
      SELECT m.operacion_id INTO v_nueva_operacion_id FROM public.movimientos_financieros AS m WHERE m.id = v_movimiento_id;
      IF v_nueva_operacion_id IS NOT NULL THEN RETURN v_nueva_operacion_id; END IF;
    END IF;
  END IF;

  IF p_tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo AS oa
    JOIN public.operaciones AS o ON o.id = oa.operacion_id
    WHERE oa.operacion_id = p_operacion_id AND o.tenant_id = v_tenant_id;
    IF v_arreglo_id IS NULL THEN RAISE EXCEPTION 'La asignación no tiene arreglo asociado' USING ERRCODE = 'P0002'; END IF;
  END IF;

  PERFORM public.rpc_borrar_operacion_con_stock(p_operacion_id, NULL);

  RETURN public.rpc_crear_operacion_con_stock(
    p_tipo, p_taller_id, p_lineas, v_arreglo_id, COALESCE(p_fecha, now()), p_cuenta_id, p_idempotency_key
  );
END;
$$;

-- ===========================================================================
-- 15. Listado unificado operaciones + gastos
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_listar_operaciones_con_gastos(timestamptz, timestamptz, text[], int, int);
CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_tipos text[] DEFAULT NULL, p_page int DEFAULT 1, p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid, tipo text, taller_id uuid, fecha timestamptz, created_at timestamptz,
  lineas jsonb, gasto_id uuid, descripcion text, categoria_gasto text,
  cuenta_financiera_id uuid, cuenta_financiera_nombre text, monto numeric, total_count bigint
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH operaciones_rows AS (
    SELECT
      o.id, o.tipo::text AS tipo, o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      NULL::uuid AS gasto_id, NULL::text AS descripcion, NULL::text AS categoria_gasto,
      NULL::uuid AS cuenta_financiera_id, NULL::text AS cuenta_financiera_nombre,
      COALESCE((SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id), 0)::numeric AS monto
    FROM public.operaciones AS o
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from) AND (p_to IS NULL OR o.fecha < p_to)
  ),
  gastos_rows AS (
    SELECT
      m.id, 'GASTO'::text AS tipo, NULL::uuid AS taller_id, m.fecha, m.created_at,
      '[]'::jsonb AS lineas, m.id AS gasto_id, m.descripcion, m.categoria_gasto,
      m.cuenta_financiera_id, c.nombre AS cuenta_financiera_nombre,
      abs(m.importe)::numeric AS monto
    FROM public.movimientos_financieros AS m
    JOIN public.cuentas_financieras AS c ON c.id = m.cuenta_financiera_id
    WHERE m.tipo = 'GASTO'
      AND m.reversa_movimiento_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
      AND m.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR m.fecha >= p_from) AND (p_to IS NULL OR m.fecha < p_to)
  ),
  filtered AS (SELECT * FROM operaciones_rows UNION ALL SELECT * FROM gastos_rows),
  typed AS (SELECT * FROM filtered WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR tipo = ANY(p_tipos))
  SELECT id, tipo, taller_id, fecha, created_at, lineas, gasto_id, descripcion,
         categoria_gasto, cuenta_financiera_id, cuenta_financiera_nombre, monto,
         COUNT(*) OVER () AS total_count
  FROM typed
  ORDER BY fecha DESC, created_at DESC, id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
$$;

-- ===========================================================================
-- 16. Stats y dashboard
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]);

DROP FUNCTION IF EXISTS public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]);
CREATE OR REPLACE FUNCTION public.rpc_operaciones_stats(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_tipos public.tipo_operacion[] DEFAULT NULL
)
RETURNS TABLE (ventas numeric, compras numeric, asignaciones numeric, gastos numeric, neto numeric)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH operaciones_totales AS (
    SELECT
      COALESCE(SUM(CASE WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS ventas,
      COALESCE(SUM(CASE WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS compras,
      COALESCE(SUM(CASE WHEN o.tipo = 'ASIGNACION_ARREGLO'::public.tipo_operacion THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0)::numeric AS asignaciones
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from) AND (p_to IS NULL OR o.fecha < p_to)
      AND (COALESCE(cardinality(p_tipos), 0) = 0 OR o.tipo = ANY(p_tipos))
  ),
  finanzas AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN m.tipo = 'GASTO' AND m.reversa_movimiento_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
          AND (COALESCE(cardinality(p_tipos), 0) = 0 OR 'GASTO' = ANY(p_tipos::text[]))
          THEN -m.importe ELSE 0 END), 0)::numeric AS gastos,
      COALESCE(SUM(CASE
        WHEN m.tipo = 'APERTURA_CUENTA' THEN 0
        WHEN COALESCE(cardinality(p_tipos), 0) = 0 THEN m.importe
        WHEN m.tipo = 'COMPRA_STOCK' AND 'COMPRA'::public.tipo_operacion = ANY(p_tipos) THEN m.importe
        WHEN m.tipo = 'VENTA_STOCK' AND 'VENTA'::public.tipo_operacion = ANY(p_tipos) THEN m.importe
        WHEN m.tipo = 'GASTO' AND 'GASTO' = ANY(p_tipos::text[]) THEN m.importe
        ELSE 0 END), 0)::numeric AS neto
    FROM public.movimientos_financieros AS m
    WHERE m.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR m.fecha >= p_from) AND (p_to IS NULL OR m.fecha < p_to)
  )
  SELECT o.ventas, o.compras, o.asignaciones, f.gastos, f.neto
  FROM operaciones_totales AS o CROSS JOIN finanzas AS f;
$$;

DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid);

DROP FUNCTION IF EXISTS public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid);
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
        WHERE (p_taller_id IS NULL OR e.taller_id = p_taller_id)
          AND es.vigente_desde < (m.mes_start + interval '1 month')::date
          AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso < (m.mes_start + interval '1 month')::date)
        ORDER BY es.empleado_id, es.vigente_desde DESC
      ) AS eff
    ) AS lat ON true
  ),
  gastos_eventuales AS (
    SELECT date_trunc(b.trunc_name, m.fecha) AS slot_start,
           COALESCE(SUM(-m.importe), 0)::numeric AS eventual
    FROM public.movimientos_financieros AS m
    LEFT JOIN public.arreglos AS a ON a.id = m.arreglo_id
    LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
    WHERE m.tipo = 'GASTO' AND m.reversa_movimiento_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
      AND m.fecha >= p_from AND m.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id OR o.taller_id = p_taller_id)
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

-- ===========================================================================
-- 17. Borrar arreglo
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.rpc_borrar_arreglo(p_arreglo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_esta_pago boolean;
  v_cobro_id uuid;
  v_operacion_ids uuid[];
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id' USING ERRCODE = '28000'; END IF;

  SELECT a.esta_pago INTO v_esta_pago FROM public.arreglos AS a
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado (%)', p_arreglo_id USING ERRCODE = 'P0002'; END IF;

  SELECT m.id INTO v_cobro_id
  FROM public.movimientos_financieros AS m
  WHERE m.tenant_id = v_tenant_id AND m.arreglo_id = p_arreglo_id AND m.tipo = 'COBRO_ARREGLO'
    AND NOT EXISTS (SELECT 1 FROM public.movimientos_financieros AS r WHERE r.reversa_movimiento_id = m.id)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC LIMIT 1;

  IF v_cobro_id IS NOT NULL THEN
    PERFORM public.rpc_finanzas_anular_cobro_arreglo(p_arreglo_id, NULL);
  ELSIF COALESCE(v_esta_pago, false) THEN
    UPDATE public.arreglos SET esta_pago = false WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
  END IF;

  v_operacion_ids := public.obtener_operaciones_por_arreglo_id(p_arreglo_id);
  PERFORM public.rpc_borrar_operaciones_con_stock_lista(v_operacion_ids);

  DELETE FROM public.arreglos WHERE id = p_arreglo_id AND tenant_id = v_tenant_id;
END;
$$;

-- ===========================================================================
-- 18. Crear arreglo completo
-- ===========================================================================

DROP FUNCTION IF EXISTS public.rpc_crear_arreglo_completo(
  uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric,
  numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamptz, uuid
);

CREATE OR REPLACE FUNCTION public.rpc_crear_arreglo_completo(
  p_vehiculo_id uuid, p_taller_id uuid, p_estado public.estado_arreglo,
  p_descripcion text, p_kilometraje_leido int, p_fecha timestamptz,
  p_observaciones text, p_precio_final numeric(10,2), p_precio_sin_iva numeric(10,2),
  p_esta_pago boolean, p_extra_data jsonb,
  p_detalles jsonb DEFAULT '[]'::jsonb, p_repuestos jsonb DEFAULT '[]'::jsonb,
  p_repuestos_nuevos jsonb DEFAULT '[]'::jsonb, p_detalle_formulario jsonb DEFAULT NULL,
  p_cuenta_id uuid DEFAULT NULL, p_fecha_cobro timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo_id uuid;
  v_movimiento_id uuid;
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
    v_movimiento_id := public._finanzas_movimiento_idempotente(v_tenant_id, p_idempotency_key, 'COBRO_ARREGLO');
    IF v_movimiento_id IS NOT NULL THEN
      SELECT m.arreglo_id INTO v_arreglo_id FROM public.movimientos_financieros AS m WHERE m.id = v_movimiento_id;
      IF v_arreglo_id IS NULL THEN RAISE EXCEPTION 'La idempotency_key no tiene arreglo asociado' USING ERRCODE = '55000'; END IF;
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
  IF p_cuenta_id IS NOT NULL THEN PERFORM public._finanzas_exigir_cuenta(p_cuenta_id, v_tenant_id, true); END IF;

  v_arreglo_id := public._insert_arreglo_base(
    p_vehiculo_id := p_vehiculo_id, p_taller_id := p_taller_id, p_estado := p_estado,
    p_descripcion := p_descripcion, p_kilometraje_leido := p_kilometraje_leido,
    p_fecha := p_fecha, p_observaciones := p_observaciones,
    p_precio_final := p_precio_final, p_precio_sin_iva := p_precio_sin_iva,
    p_esta_pago := false, p_extra_data := p_extra_data
  );

  PERFORM public._insert_detalles_arreglo(v_arreglo_id, p_detalles);
  PERFORM public._insert_detalle_form_custom(v_arreglo_id, p_detalle_formulario);
  PERFORM public._asignar_repuestos_existentes_a_arreglo(v_arreglo_id, p_taller_id, p_repuestos, p_cuenta_id);
  PERFORM public._crear_repuestos_nuevos_para_arreglo(v_arreglo_id, p_taller_id, p_repuestos_nuevos, p_cuenta_id);

  UPDATE public.arreglos
  SET precio_final = COALESCE(p_precio_final, precio_final),
      precio_sin_iva = COALESCE(p_precio_sin_iva, precio_sin_iva), updated_at = now()
  WHERE id = v_arreglo_id AND tenant_id = v_tenant_id;

  IF COALESCE(p_esta_pago, false) THEN
    PERFORM public.rpc_finanzas_cobrar_arreglo(
      v_arreglo_id, p_cuenta_id, COALESCE(p_fecha_cobro, p_fecha), p_idempotency_key
    );
  END IF;

  RETURN v_arreglo_id;
END;
$$;

-- ===========================================================================
-- 19. Grants
-- ===========================================================================

ALTER TABLE public.movimientos_financieros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movimientos_financieros_tenant_select ON public.movimientos_financieros;
CREATE POLICY movimientos_financieros_tenant_select ON public.movimientos_financieros
  FOR SELECT TO authenticated USING (tenant_id = (SELECT public.current_tenant_id()));

REVOKE ALL ON TABLE public.movimientos_financieros FROM PUBLIC;
REVOKE ALL ON TABLE public.movimientos_financieros FROM anon;
GRANT SELECT ON TABLE public.movimientos_financieros TO authenticated;
GRANT SELECT ON TABLE public.movimientos_financieros TO service_role;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamptz, timestamptz, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_transferir(uuid, uuid, numeric, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_transferencia(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_transferencia(uuid, uuid, uuid, numeric, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_transferencia(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_registrar_gasto(uuid, text, numeric, text, timestamptz, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_gastos(timestamptz, timestamptz, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_obtener_gasto(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_actualizar_gasto(uuid, uuid, text, numeric, text, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_eliminar_gasto(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamptz, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, public.tipo_operacion, uuid, jsonb, timestamptz, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz, timestamptz, text[], int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_borrar_arreglo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_cuentas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_cuenta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_crear_cuenta(text, text, numeric, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_cuenta(uuid, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_cuenta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamptz, timestamptz, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_transferir(uuid, uuid, numeric, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_transferencia(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_transferencia(uuid, uuid, uuid, numeric, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_transferencia(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_registrar_gasto(uuid, text, numeric, text, timestamptz, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_listar_gastos(timestamptz, timestamptz, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_obtener_gasto(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_actualizar_gasto(uuid, uuid, text, numeric, text, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_eliminar_gasto(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_cobrar_arreglo(uuid, uuid, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finanzas_anular_cobro_arreglo(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_operacion_con_stock(public.tipo_operacion, uuid, jsonb, uuid, timestamptz, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_operacion_con_stock(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_actualizar_operacion_con_stock(uuid, public.tipo_operacion, uuid, jsonb, timestamptz, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_listar_operaciones_con_gastos(timestamptz, timestamptz, text[], int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_gastos_por_periodo(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_borrar_arreglo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_arreglo_completo(uuid, uuid, public.estado_arreglo, text, int, timestamptz, text, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_asignar_repuesto_existente_con_compra(uuid, uuid, uuid, int, numeric, numeric, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_crear_producto_inline_para_arreglo(uuid, uuid, text, text, numeric, numeric, int, uuid, uuid, uuid, uuid) TO authenticated, service_role;
