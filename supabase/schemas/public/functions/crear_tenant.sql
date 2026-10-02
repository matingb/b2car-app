CREATE OR REPLACE FUNCTION public.crear_tenant (
  p_config jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."crear_tenant"(jsonb) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."crear_tenant"(jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."crear_tenant"(jsonb) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."crear_tenant"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."crear_tenant"(jsonb) TO "postgres";
