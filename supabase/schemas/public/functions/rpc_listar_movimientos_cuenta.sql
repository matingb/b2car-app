CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_cuenta (
  p_cuenta_id uuid,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_limit     integer                  DEFAULT 100,
  p_offset    integer                  DEFAULT 0
)
  RETURNS TABLE (
    id                   uuid,
    cuenta_financiera_id uuid,
    importe              numeric,
    fecha                timestamp with time zone,
    created_at           timestamp with time zone,
    operacion_id         uuid,
    tipo                 text,
    descripcion          text,
    categoria_gasto      text,
    arreglo_id           uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  SELECT
    m.id, m.cuenta_financiera_id, m.importe, m.fecha, m.created_at, m.operacion_id,
    CASE
      WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
      ELSE COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO')
    END AS tipo,
    omc.descripcion, omc.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = m.operacion_id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_movimientos_cuenta"(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_movimientos_cuenta"(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_listar_movimientos_cuenta"(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_listar_movimientos_cuenta"(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_movimientos_cuenta"(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO "postgres";
