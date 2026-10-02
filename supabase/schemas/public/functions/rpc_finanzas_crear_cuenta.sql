CREATE OR REPLACE FUNCTION public.rpc_finanzas_crear_cuenta (
  p_nombre          text,
  p_tipo            text,
  p_saldo_inicial   numeric                  DEFAULT 0,
  p_fecha           timestamp with time zone DEFAULT now(),
  p_idempotency_key uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    id            uuid,
    tenant_id     uuid,
    nombre        text,
    tipo          text,
    activo        boolean,
    saldo_inicial numeric,
    saldo_actual  numeric,
    saldo         numeric,
    created_at    timestamp with time zone,
    updated_at    timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
END; $function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_crear_cuenta"(text, text, numeric, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_crear_cuenta"(text, text, numeric, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_crear_cuenta"(text, text, numeric, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_crear_cuenta"(text, text, numeric, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_crear_cuenta"(text, text, numeric, timestamp WITH time zone, uuid) TO "postgres";
