CREATE OR REPLACE FUNCTION public._finanzas_crear_cuenta_para_tenant (
  p_tenant_id     uuid,
  p_nombre        text,
  p_tipo          text,
  p_saldo_inicial numeric,
  p_created_by    uuid,
  p_fecha         timestamp with time zone DEFAULT now()
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."_finanzas_crear_cuenta_para_tenant"(uuid, text, text, numeric, uuid, timestamp WITH time zone) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_crear_cuenta_para_tenant"(uuid, text, text, numeric, uuid, timestamp WITH time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_crear_cuenta_para_tenant"(uuid, text, text, numeric, uuid, timestamp WITH time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."_finanzas_crear_cuenta_para_tenant"(uuid, text, text, numeric, uuid, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_finanzas_crear_cuenta_para_tenant"(uuid, text, text, numeric, uuid, timestamp WITH time zone) TO "postgres";
