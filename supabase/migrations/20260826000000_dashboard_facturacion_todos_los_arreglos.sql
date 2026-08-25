-- La tarjeta de Facturación representa el valor total de los arreglos cargados
-- dentro del período, independientemente de si ya fueron cobrados total o parcialmente.
-- El estado y los importes cobrados se conservan en las demás columnas del resumen.

CREATE OR REPLACE FUNCTION public.dashboard_arreglos_resumen(
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_taller_id uuid        DEFAULT NULL
)
RETURNS TABLE(total integer, cobrados integer, pendientes integer, parciales integer, monto_ingresos numeric)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int                                                                          AS total,
    COUNT(*) FILTER (WHERE a.esta_pago = true)::int                                        AS cobrados,
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.total_cobrado, 0) <= 0)::int AS pendientes,
    COUNT(*) FILTER (WHERE a.esta_pago = false AND COALESCE(a.total_cobrado, 0) > 0)::int  AS parciales,
    COALESCE(SUM(a.precio_final), 0)::numeric                                               AS monto_ingresos
  FROM public.arreglos a
  WHERE (p_from IS NULL OR a.fecha >= p_from)
    AND (p_to   IS NULL OR a.fecha <  p_to)
    AND (p_taller_id IS NULL OR a.taller_id = p_taller_id);
$$;

REVOKE ALL ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_arreglos_resumen(timestamptz, timestamptz, uuid)
  TO authenticated, service_role;
