CREATE OR REPLACE FUNCTION public.rpc_finanzas_actualizar_cuenta (
  p_cuenta_id uuid,
  p_nombre    text    DEFAULT NULL::text,
  p_tipo      text    DEFAULT NULL::text,
  p_activo    boolean DEFAULT NULL::boolean,
  p_favorita  boolean DEFAULT NULL::boolean
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_actualizar_cuenta"(uuid, text, text, boolean, boolean) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_actualizar_cuenta"(uuid, text, text, boolean, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_actualizar_cuenta"(uuid, text, text, boolean, boolean) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_actualizar_cuenta"(uuid, text, text, boolean, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_actualizar_cuenta"(uuid, text, text, boolean, boolean) TO "postgres";
