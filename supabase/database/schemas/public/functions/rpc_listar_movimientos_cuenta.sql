CREATE FUNCTION public.rpc_listar_movimientos_cuenta (
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
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    COALESCE(o.tipo::text, 'MOVIMIENTO') AS tipo,
    CASE
      WHEN m.reversion_de_id IS NOT NULL THEN
        'Anulación — ' || COALESCE(
          omc.descripcion,
          og.descripcion,
          oi.concepto,
          CASE
            WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
            WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
            WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
            WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
            WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
            ELSE o.observaciones
          END,
          'movimiento'
        )
      ELSE
        COALESCE(
          omc.descripcion,
          og.descripcion,
          oi.concepto,
          CASE
            WHEN o.tipo = 'VENTA'::public.tipo_operacion THEN 'Cobro de venta'
            WHEN o.tipo = 'COMPRA'::public.tipo_operacion THEN 'Pago de compra'
            WHEN o.tipo = 'COBRO_ARREGLO'::public.tipo_operacion THEN 'Cobro de arreglo'
            WHEN o.tipo = 'TRANSFERENCIA'::public.tipo_operacion THEN 'Transferencia entre cuentas'
            WHEN o.tipo = 'APERTURA_CUENTA'::public.tipo_operacion THEN 'Apertura de cuenta'
            ELSE o.observaciones
          END
        )
    END AS descripcion,
    og.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.id = m.omc_id
  LEFT JOIN public.operaciones AS o ON o.id = COALESCE(omc.operacion_id, m.operacion_id)
  LEFT JOIN public.operaciones_gasto AS og ON og.operacion_id = o.id
  LEFT JOIN public.operaciones_ingreso AS oi ON oi.operacion_id = o.id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO anon;

GRANT ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp WITH time zone, timestamp WITH time zone, integer, integer) TO service_role;