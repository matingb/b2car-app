CREATE FUNCTION public.rpc_finanzas_listar_cuentas()
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
  LEFT JOIN (
    public.operaciones_movimiento_cuenta AS omc
    JOIN public.operaciones AS o ON o.id = omc.operacion_id AND o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion
  ) ON omc.cuenta_id = c.id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
  GROUP BY c.id
  ORDER BY c.activo DESC, c.favorita DESC, lower(c.nombre), c.created_at;
$function$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() TO anon;

GRANT ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() TO authenticated;

GRANT ALL ON FUNCTION public.rpc_finanzas_listar_cuentas() TO service_role;