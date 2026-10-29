-- Migration: 20261029110000_listar_movimientos_cuenta_operaciones_pagos.sql
-- Description: Actualiza rpc_listar_movimientos_cuenta para resolver descripcion desde operaciones_pagos y estandarizar tipo VENTA y COMPRA.

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
    m.id,
    m.cuenta_financiera_id,
    m.importe,
    m.fecha,
    m.created_at,
    m.operacion_id,
    CASE
      WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
      WHEN o.tipo IN ('VENTA', 'COMPRA') THEN o.tipo::text
      ELSE COALESCE(omc.subtipo, o.tipo::text, 'MOVIMIENTO')
    END AS tipo,
    COALESCE(
      omc.descripcion,
      op.descripcion,
      o.observaciones,
      CASE
        WHEN o.tipo = 'VENTA' THEN 'Cobro de venta'
        WHEN o.tipo = 'COMPRA' THEN 'Pago de compra'
        ELSE NULL
      END
    ) AS descripcion,
    omc.categoria_gasto,
    COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
  FROM public.movimientos_financieros AS m
  LEFT JOIN public.operaciones AS o ON o.id = m.operacion_id
  LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = m.operacion_id
  LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = m.operacion_id
  LEFT JOIN LATERAL (
    SELECT op_sub.descripcion
    FROM public.operaciones_pagos op_sub
    WHERE (
      op_sub.operacion_pago_id = m.operacion_id
      OR (op_sub.operacion_id = m.operacion_id AND op_sub.cuenta_financiera_id = m.cuenta_financiera_id)
    )
    AND op_sub.tenant_id = m.tenant_id
    ORDER BY op_sub.created_at DESC
    LIMIT 1
  ) op ON true
  WHERE m.cuenta_financiera_id = p_cuenta_id
    AND m.tenant_id = (SELECT public.current_tenant_id())
    AND (p_from IS NULL OR m.fecha >= p_from)
    AND (p_to IS NULL OR m.fecha < p_to)
  ORDER BY m.fecha DESC, m.created_at DESC, m.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_listar_movimientos_cuenta(uuid, timestamp with time zone, timestamp with time zone, integer, integer) TO anon, authenticated, service_role, postgres;
