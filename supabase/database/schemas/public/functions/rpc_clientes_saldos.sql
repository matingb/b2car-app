CREATE FUNCTION public.rpc_clientes_saldos (
  p_cliente_ids uuid[] DEFAULT NULL::uuid[]
)
  RETURNS TABLE (
    cliente_id uuid,
    saldo      numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  WITH arreglos_saldo AS (
    SELECT
      COALESCE(a.cliente_id, v.cliente_id) AS cliente_id,
      COALESCE(SUM(COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0)), 0) AS saldo
    FROM public.arreglos a
    LEFT JOIN public.vehiculos v ON v.id = a.vehiculo_id
    WHERE a.tenant_id = (SELECT public.current_tenant_id())
      AND a.estado != 'PRESUPUESTO'
      AND (p_cliente_ids IS NULL OR COALESCE(a.cliente_id, v.cliente_id) = ANY(p_cliente_ids))
    GROUP BY COALESCE(a.cliente_id, v.cliente_id)
  ),
  ventas_saldo AS (
    SELECT
      ov.cliente_id,
      COALESCE(SUM(COALESCE(o.monto_total, 0) - COALESCE(o.total_pagado, 0)), 0) AS saldo
    FROM public.operaciones_venta ov
    JOIN public.operaciones o ON o.id = ov.operacion_id
    WHERE ov.tenant_id = (SELECT public.current_tenant_id())
      AND o.tipo = 'VENTA'
      AND (p_cliente_ids IS NULL OR ov.cliente_id = ANY(p_cliente_ids))
    GROUP BY ov.cliente_id
  ),
  saldos_unificados AS (
    SELECT cliente_id, saldo FROM arreglos_saldo
    UNION ALL
    SELECT cliente_id, saldo FROM ventas_saldo
  )
  SELECT
    c.id AS cliente_id,
    COALESCE(SUM(su.saldo), 0)::numeric AS saldo
  FROM public.clientes c
  LEFT JOIN saldos_unificados su ON su.cliente_id = c.id
  WHERE c.tenant_id = (SELECT public.current_tenant_id())
    AND (p_cliente_ids IS NULL OR c.id = ANY(p_cliente_ids))
  GROUP BY c.id;
$function$;

GRANT ALL ON FUNCTION public.rpc_clientes_saldos(uuid[]) TO anon;

GRANT ALL ON FUNCTION public.rpc_clientes_saldos(uuid[]) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_clientes_saldos(uuid[]) TO service_role;