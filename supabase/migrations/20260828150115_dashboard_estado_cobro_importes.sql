-- El grÃ¡fico de estado de cobro necesita tanto las cantidades como los importes
-- de cada categorÃ­a. La tarjeta de FacturaciÃ³n conserva su semÃ¡ntica actual:
-- monto_ingresos es la suma presupuestada de los arreglos del perÃ­odo.
DROP FUNCTION IF EXISTS public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid);

CREATE FUNCTION public.dashboard_arreglos_resumen(
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(
  total integer,
  cobrados integer,
  pendientes integer,
  parciales integer,
  monto_ingresos numeric,
  monto_cobrado_total numeric,
  monto_cobrado_parcial numeric,
  monto_pendiente_parcial numeric,
  monto_pendiente numeric
)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int AS cobrados,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    )::int AS pendientes,
    COUNT(*) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    )::int AS parciales,
    COALESCE(SUM(a.precio_final), 0)::numeric AS monto_ingresos,
    COALESCE(SUM(a.total_cobrado) FILTER (WHERE a.esta_pago = true), 0)::numeric AS monto_cobrado_total,
    COALESCE(SUM(a.total_cobrado) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_cobrado_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) > 0
    ), 0)::numeric AS monto_pendiente_parcial,
    COALESCE(SUM(GREATEST(0, COALESCE(a.precio_final, 0) - COALESCE(a.total_cobrado, 0))) FILTER (
      WHERE a.esta_pago = false
        AND COALESCE(a.total_cobrado, 0) <= 0
    ), 0)::numeric AS monto_pendiente
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to IS NULL OR a.fecha < p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id);
$$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid)
  TO authenticated, service_role;

