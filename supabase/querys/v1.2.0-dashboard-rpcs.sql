-- v1.2.0
-- RPCs optimizados para stats del dashboard (agregaciones). Respetan RLS via SECURITY INVOKER.

-- Count clientes
CREATE OR REPLACE FUNCTION public.dashboard_count_clientes()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.clientes;
$$;

-- Count vehiculos
CREATE OR REPLACE FUNCTION public.dashboard_count_vehiculos()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.vehiculos;
$$;

-- Count arreglos
CREATE OR REPLACE FUNCTION public.dashboard_count_arreglos()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.arreglos;
$$;

-- Count arreglos by pago
CREATE OR REPLACE FUNCTION public.dashboard_count_arreglos_by_pago(p_esta_pago boolean)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.arreglos
  WHERE esta_pago = p_esta_pago;
$$;

-- Sum ingresos (precio_final) en un rango [from, to)
CREATE OR REPLACE FUNCTION public.dashboard_sum_ingresos(p_from timestamptz, p_to timestamptz)
RETURNS numeric
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(a.precio_final), 0)::numeric
  FROM public.arreglos a
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$$;

-- Tipos de arreglos con cantidad e ingresos (all-time)
CREATE OR REPLACE FUNCTION public.dashboard_tipos_con_ingresos()
RETURNS TABLE(tipo text, cantidad integer, ingresos numeric)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(a.tipo), ''), 'Sin tipo')::text AS tipo,
    COUNT(*)::int AS cantidad,
    COALESCE(SUM(a.precio_final), 0)::numeric AS ingresos
  FROM public.arreglos a
  GROUP BY 1
  ORDER BY cantidad DESC, tipo ASC;
$$;

-- Clientes nuevos por día en un rango [from, to) con días faltantes en 0.
-- Retorna label "DD/MM" + valor.
CREATE OR REPLACE FUNCTION public.dashboard_clientes_nuevos_por_dia(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(label text, valor integer)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', p_from),
      date_trunc('day', p_to - interval '1 second'),
      interval '1 day'
    ) AS day
  ),
  agg AS (
    SELECT date_trunc('day', c.fecha_creacion) AS day, COUNT(*)::int AS valor
    FROM public.clientes c
    WHERE c.fecha_creacion >= p_from
      AND c.fecha_creacion < p_to
    GROUP BY 1
  )
  SELECT
    to_char(days.day::date, 'DD/MM') AS label,
    COALESCE(agg.valor, 0)::int AS valor
  FROM days
  LEFT JOIN agg USING (day)
  ORDER BY days.day ASC;
$$;


