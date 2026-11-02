CREATE FUNCTION public.rpc_finanzas_listar_movimientos (
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
  SELECT * FROM public.rpc_listar_movimientos_cuenta(p_cuenta_id, p_from, p_to, p_limit, p_offset);
$function$;

REVOKE ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_finanzas_listar_movimientos(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO service_role;