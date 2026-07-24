-- Mantiene la navegación de operaciones acotada al tenant y al período solicitado.
CREATE INDEX IF NOT EXISTS idx_operaciones_tenant_fecha_created_id
ON public.operaciones (tenant_id, fecha DESC, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.rpc_operaciones_stats(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_tipos public.tipo_operacion[] DEFAULT NULL
)
RETURNS TABLE (
  ventas numeric,
  compras numeric,
  asignaciones numeric,
  neto numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN o.tipo = 'VENTA' THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0) AS ventas,
    COALESCE(SUM(CASE WHEN o.tipo = 'COMPRA' THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0) AS compras,
    COALESCE(SUM(CASE WHEN o.tipo = 'ASIGNACION_ARREGLO' THEN ol.cantidad * ol.monto_unitario ELSE 0 END), 0) AS asignaciones,
    COALESCE(SUM(CASE
      WHEN o.tipo = 'VENTA' THEN ol.cantidad * ol.monto_unitario
      WHEN o.tipo = 'COMPRA' THEN -(ol.cantidad * ol.monto_unitario)
      WHEN o.tipo = 'ASIGNACION_ARREGLO' THEN ol.cantidad * ol.monto_unitario
      ELSE 0
    END), 0) AS neto
  FROM public.operaciones AS o
  LEFT JOIN public.operaciones_lineas AS ol ON ol.operacion_id = o.id
  WHERE (p_from IS NULL OR o.fecha >= p_from)
    AND (p_to IS NULL OR o.fecha < p_to)
    AND (p_tipos IS NULL OR o.tipo = ANY(p_tipos));
$$;

GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_operaciones_stats(timestamptz, timestamptz, public.tipo_operacion[]) TO service_role;
