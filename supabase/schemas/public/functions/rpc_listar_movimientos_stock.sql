CREATE OR REPLACE FUNCTION public.rpc_listar_movimientos_stock (
  p_producto_id  uuid,
  p_taller_id    uuid DEFAULT NULL,
  p_limite       int  DEFAULT 50,
  p_offset       int  DEFAULT 0
)
  RETURNS TABLE (
    id                uuid,
    tenant_id         uuid,
    taller_id         uuid,
    taller_nombre     text,
    producto_id       uuid,
    producto_nombre   text,
    producto_codigo   text,
    stock_id          uuid,
    operacion_id      uuid,
    operacion_tipo    text,
    tipo_movimiento   text,
    cantidad          int,
    saldo_anterior    int,
    saldo_posterior   int,
    fecha             timestamptz,
    motivo            text,
    created_by        uuid,
    created_at        timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT
    ms.id,
    ms.tenant_id,
    ms.taller_id,
    t.nombre AS taller_nombre,
    ms.producto_id,
    p.nombre AS producto_nombre,
    p.codigo AS producto_codigo,
    ms.stock_id,
    ms.operacion_id,
    o.tipo::text AS operacion_tipo,
    ms.tipo_movimiento,
    ms.cantidad,
    ms.saldo_anterior,
    ms.saldo_posterior,
    ms.fecha,
    ms.motivo,
    ms.created_by,
    ms.created_at
  FROM public.movimientos_stock ms
  JOIN public.talleres t ON t.id = ms.taller_id
  JOIN public.productos p ON p.id = ms.producto_id
  LEFT JOIN public.operaciones o ON o.id = ms.operacion_id
  WHERE ms.tenant_id = public.current_tenant_id()
    AND ms.producto_id = p_producto_id
    AND (p_taller_id IS NULL OR ms.taller_id = p_taller_id)
  ORDER BY ms.fecha DESC, ms.created_at DESC
  LIMIT LEAST(COALESCE(p_limite, 50), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_stock TO "anon", "authenticated", "service_role", "postgres";
