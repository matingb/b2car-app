-- B2C-141: alta inicial, manual y atómica de tenants.
--
-- Uso previsto (desde SQL Editor con un rol administrador de base):
--
--   SELECT public.crear_tenant(
--     '{
--       "tenant": { "nombre": "Taller Norte" },
--       "administrador_id": "UUID_EXISTENTE_EN_AUTH_USERS",
--       "taller_principal": { "nombre": "Sede central", "ubicacion": "Dirección" },
--       "cuenta_financiera_inicial": {
--         "nombre": "Caja", "tipo": "EFECTIVO", "saldo_inicial": 0
--       },
--       "categorias_arreglo": ["Service", "Frenos", "Electricidad"]
--     }'::jsonb
--   );
--
-- No se expone a la Data API ni a un servicio web. Esta migración reemplaza la
-- alta mínima creada en 20260717183929_tenant_lifecycle_rpcs.sql, sin introducir
-- otra función de alta con nombre diferente.

-- El helper existente usa auth.uid(), que no está disponible al ejecutar desde
-- SQL Editor. Esta sobrecarga recibe el administrador explícitamente para que el
-- movimiento de apertura conserve su autor real.
CREATE OR REPLACE FUNCTION public._crear_apertura_cuenta(
  p_tenant_id uuid,
  p_cuenta_id uuid,
  p_saldo numeric,
  p_fecha timestamptz,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operacion_id uuid;
BEGIN
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id, fecha)
  VALUES (p_tenant_id, 'MOVIMIENTO_CUENTA', NULL, COALESCE(p_fecha, now()))
  RETURNING id INTO v_operacion_id;

  INSERT INTO public.operaciones_movimiento_cuenta (
    operacion_id,
    tenant_id,
    subtipo,
    cuenta_id,
    importe,
    created_by
  )
  VALUES (
    v_operacion_id,
    p_tenant_id,
    'APERTURA_CUENTA',
    p_cuenta_id,
    p_saldo,
    p_created_by
  );

  RETURN v_operacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public._crear_apertura_cuenta(uuid, uuid, numeric, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Núcleo privado para cuentas creadas sin JWT. Mantiene el flujo financiero
-- canónico: cuenta en saldo cero + movimiento de apertura que genera el ledger
-- y actualiza el saldo por los triggers vigentes.
CREATE OR REPLACE FUNCTION public._finanzas_crear_cuenta_para_tenant(
  p_tenant_id uuid,
  p_nombre text,
  p_tipo text,
  p_saldo_inicial numeric,
  p_created_by uuid,
  p_fecha timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cuenta_id uuid;
  v_nombre text := nullif(btrim(p_nombre), '');
  v_tipo text := upper(nullif(btrim(p_tipo), ''));
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF p_created_by IS NULL THEN
    RAISE EXCEPTION 'administrador_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'El nombre de la cuenta inicial es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF v_tipo NOT IN ('EFECTIVO', 'CUENTA_BANCARIA', 'BILLETERA_DIGITAL', 'TARJETA_CREDITO') THEN
    RAISE EXCEPTION 'Tipo de cuenta inicial inválido: %', p_tipo
      USING ERRCODE = '22023';
  END IF;

  IF p_saldo_inicial IS NULL THEN
    RAISE EXCEPTION 'El saldo inicial debe ser numérico'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.cuentas_financieras (
    tenant_id,
    nombre,
    tipo,
    saldo,
    activo
  )
  VALUES (
    p_tenant_id,
    v_nombre,
    v_tipo,
    0,
    true
  )
  RETURNING id INTO v_cuenta_id;

  IF p_saldo_inicial <> 0 THEN
    PERFORM public._crear_apertura_cuenta(
      p_tenant_id,
      v_cuenta_id,
      p_saldo_inicial,
      COALESCE(p_fecha, now()),
      p_created_by
    );
  END IF;

  RETURN v_cuenta_id;
END;
$$;

REVOKE ALL ON FUNCTION public._finanzas_crear_cuenta_para_tenant(uuid, text, text, numeric, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- La firma anterior es reemplazada, no sobrecargada: existe un único contrato
-- público para el alta inicial de tenant.
DROP FUNCTION IF EXISTS public.crear_tenant(text, uuid);

CREATE FUNCTION public.crear_tenant(p_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_nombre text;
  v_administrador_text text;
  v_administrador_id uuid;
  v_taller_nombre text;
  v_taller_ubicacion text;
  v_tenant_id uuid;
  v_taller_id uuid;
  v_cuenta_id uuid;
  v_cuenta_config jsonb;
  v_cuenta_nombre text;
  v_cuenta_tipo text;
  v_cuenta_saldo numeric := 0;
  v_categorias_config jsonb;
  v_categorias text[];
  v_categorias_creadas jsonb;
BEGIN
  IF jsonb_typeof(p_config) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_config debe ser un objeto JSON'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_config -> 'tenant') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'tenant debe ser un objeto JSON'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_config -> 'tenant' -> 'nombre') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'tenant.nombre es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  v_tenant_nombre := nullif(btrim(p_config #>> '{tenant,nombre}'), '');
  IF v_tenant_nombre IS NULL THEN
    RAISE EXCEPTION 'tenant.nombre es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_config -> 'administrador_id') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'administrador_id debe ser un UUID existente en auth.users'
      USING ERRCODE = '22023';
  END IF;

  v_administrador_text := nullif(btrim(p_config ->> 'administrador_id'), '');
  IF v_administrador_text IS NULL THEN
    RAISE EXCEPTION 'administrador_id es obligatorio'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_administrador_id := v_administrador_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'administrador_id debe tener formato UUID'
      USING ERRCODE = '22023';
  END;

  IF jsonb_typeof(p_config -> 'taller_principal') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'taller_principal debe ser un objeto JSON'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_config -> 'taller_principal' -> 'nombre') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_config -> 'taller_principal' -> 'ubicacion') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'taller_principal.nombre y taller_principal.ubicacion son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  v_taller_nombre := nullif(btrim(p_config #>> '{taller_principal,nombre}'), '');
  v_taller_ubicacion := nullif(btrim(p_config #>> '{taller_principal,ubicacion}'), '');
  IF v_taller_nombre IS NULL OR v_taller_ubicacion IS NULL THEN
    RAISE EXCEPTION 'taller_principal.nombre y taller_principal.ubicacion son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_config ? 'categorias_arreglo') OR p_config -> 'categorias_arreglo' IS NULL
    OR p_config -> 'categorias_arreglo' = 'null'::jsonb THEN
    v_categorias := ARRAY['Service', 'Frenos', 'Electricidad'];
  ELSE
    v_categorias_config := p_config -> 'categorias_arreglo';
    IF jsonb_typeof(v_categorias_config) <> 'array' THEN
      RAISE EXCEPTION 'categorias_arreglo debe ser un arreglo de textos'
        USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_categorias_config) = 0 THEN
      RAISE EXCEPTION 'categorias_arreglo no puede estar vacío'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_categorias_config) AS categoria(valor)
      WHERE jsonb_typeof(categoria.valor) <> 'string'
        OR nullif(btrim(categoria.valor #>> '{}'), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'categorias_arreglo solo admite textos no vacíos'
        USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(btrim(categoria.valor #>> '{}') ORDER BY categoria.orden)
      INTO v_categorias
    FROM jsonb_array_elements(v_categorias_config) WITH ORDINALITY AS categoria(valor, orden);

    IF EXISTS (
      SELECT 1
      FROM unnest(v_categorias) AS categoria(nombre)
      GROUP BY lower(nombre)
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'categorias_arreglo no puede contener duplicados'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_config ? 'cuenta_financiera_inicial'
    AND p_config -> 'cuenta_financiera_inicial' IS NOT NULL
    AND p_config -> 'cuenta_financiera_inicial' <> 'null'::jsonb THEN
    v_cuenta_config := p_config -> 'cuenta_financiera_inicial';
    IF jsonb_typeof(v_cuenta_config) <> 'object' THEN
      RAISE EXCEPTION 'cuenta_financiera_inicial debe ser un objeto JSON'
        USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(v_cuenta_config -> 'nombre') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_cuenta_config -> 'tipo') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'cuenta_financiera_inicial.nombre y cuenta_financiera_inicial.tipo son obligatorios'
        USING ERRCODE = '22023';
    END IF;

    v_cuenta_nombre := nullif(btrim(v_cuenta_config ->> 'nombre'), '');
    v_cuenta_tipo := upper(nullif(btrim(v_cuenta_config ->> 'tipo'), ''));
    IF v_cuenta_nombre IS NULL OR v_cuenta_tipo IS NULL THEN
      RAISE EXCEPTION 'cuenta_financiera_inicial.nombre y cuenta_financiera_inicial.tipo son obligatorios'
        USING ERRCODE = '22023';
    END IF;

    IF v_cuenta_config ? 'saldo_inicial' AND v_cuenta_config -> 'saldo_inicial' <> 'null'::jsonb THEN
      IF jsonb_typeof(v_cuenta_config -> 'saldo_inicial') <> 'number' THEN
        RAISE EXCEPTION 'cuenta_financiera_inicial.saldo_inicial debe ser numérico'
          USING ERRCODE = '22023';
      END IF;
      v_cuenta_saldo := (v_cuenta_config ->> 'saldo_inicial')::numeric;
    END IF;
  END IF;

  PERFORM 1
  FROM auth.users AS usuario
  WHERE usuario.id = v_administrador_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el usuario administrador %', v_administrador_id
      USING ERRCODE = 'P0002';
  END IF;

  -- La PK de tenant_members ya impide una segunda membresía. El lock da un
  -- error determinista ante dos altas concurrentes del mismo administrador.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_administrador_id::text, 0));

  PERFORM 1
  FROM public.tenant_members AS membresia
  WHERE membresia.cliente_id = v_administrador_id
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'El usuario administrador % ya pertenece a un tenant', v_administrador_id
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.tenants (nombre, estado)
  VALUES (v_tenant_nombre, 'activo')
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_members (cliente_id, tenant_id, rol)
  VALUES (v_administrador_id, v_tenant_id, 'admin');

  INSERT INTO public.talleres (tenant_id, nombre, ubicacion)
  VALUES (v_tenant_id, v_taller_nombre, v_taller_ubicacion)
  RETURNING id INTO v_taller_id;

  WITH categorias AS (
    INSERT INTO public.categorias_arreglo (tenant_id, nombre)
    SELECT v_tenant_id, categoria.nombre
    FROM unnest(v_categorias) WITH ORDINALITY AS categoria(nombre, orden)
    ORDER BY categoria.orden
    RETURNING id, nombre
  )
  SELECT jsonb_agg(
    jsonb_build_object('id', categorias.id, 'nombre', categorias.nombre)
    ORDER BY categorias.nombre
  )
  INTO v_categorias_creadas
  FROM categorias;

  IF v_cuenta_config IS NOT NULL THEN
    v_cuenta_id := public._finanzas_crear_cuenta_para_tenant(
      v_tenant_id,
      v_cuenta_nombre,
      v_cuenta_tipo,
      v_cuenta_saldo,
      v_administrador_id
    );
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'administrador_id', v_administrador_id,
    'taller_principal_id', v_taller_id,
    'cuenta_financiera_id', v_cuenta_id,
    'categorias', COALESCE(v_categorias_creadas, '[]'::jsonb)
  );
END;
$$;

-- Esta función es sólo para ejecución manual administrativa desde SQL Editor.
-- El propietario de la función puede invocarla; no se otorga acceso a roles de
-- API ni a service_role.
REVOKE ALL ON FUNCTION public.crear_tenant(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
