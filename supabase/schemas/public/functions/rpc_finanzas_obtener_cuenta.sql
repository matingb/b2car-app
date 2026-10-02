CREATE OR REPLACE FUNCTION public.rpc_finanzas_obtener_cuenta (
  p_cuenta_id uuid
)
  RETURNS TABLE (
    id            uuid,
    tenant_id     uuid,
    nombre        text,
    tipo          text,
    activo        boolean,
    favorita      boolean,
    saldo_inicial numeric,
    saldo_actual  numeric,
    saldo         numeric,
    created_at    timestamp with time zone,
    updated_at    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_obtener_cuenta"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_obtener_cuenta"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_obtener_cuenta"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_finanzas_obtener_cuenta"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_finanzas_obtener_cuenta"(uuid) TO "postgres";
