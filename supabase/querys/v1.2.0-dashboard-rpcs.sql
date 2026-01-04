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
-- Devuelve el TOP N por cantidad y agrega una fila "Otros" con la suma del resto.
CREATE OR REPLACE FUNCTION public.dashboard_tipos_con_ingresos(p_top integer DEFAULT 4)
RETURNS TABLE(tipo text, cantidad integer, ingresos numeric)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(a.tipo), ''), 'Sin tipo')::text AS tipo,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(a.precio_final), 0)::numeric AS ingresos
    FROM public.arreglos a
    GROUP BY 1
  ),
  ranked AS (
    SELECT
      a.tipo,
      a.cantidad,
      a.ingresos,
      ROW_NUMBER() OVER (ORDER BY a.cantidad DESC, a.tipo ASC) AS rn
    FROM agg a
  ),
  top_rows AS (
    SELECT tipo, cantidad, ingresos
    FROM ranked
    WHERE rn <= GREATEST(COALESCE(p_top, 0), 0)
  ),
  otros AS (
    SELECT
      'Otros'::text AS tipo,
      COALESCE(SUM(cantidad), 0)::int AS cantidad,
      COALESCE(SUM(ingresos), 0)::numeric AS ingresos
    FROM ranked
    WHERE rn > GREATEST(COALESCE(p_top, 0), 0)
  )
  SELECT s.tipo, s.cantidad, s.ingresos
  FROM (
    SELECT tipo, cantidad, ingresos, 0 AS sort_group
    FROM top_rows
    UNION ALL
    SELECT tipo, cantidad, ingresos, 1 AS sort_group
    FROM otros
    WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.cantidad DESC, s.tipo ASC;
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

-- Modifica custom_claims para agregar tenant_name en claims
CREATE OR REPLACE FUNCTION public.custom_claims(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  tenant_uuid uuid;
  tenant_name text;
  user_id     uuid;
  user_role   text;
BEGIN
  claims := event->'claims';

  IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
    RETURN event;
  END IF;

  user_id := (claims->>'sub')::uuid;

  SELECT tm.tenant_id, tm.rol
    INTO tenant_uuid, user_role
  FROM public.tenant_members tm
  WHERE tm.cliente_id = user_id
  LIMIT 1;

  SELECT t.nombre
    INTO tenant_name
  FROM public.tenants t
  WHERE t.id = tenant_uuid;


  IF tenant_uuid IS NULL THEN
    RETURN event;
  END IF;

  claims := claims
    || jsonb_build_object('tenant_id', tenant_uuid)
    || jsonb_build_object('user_role', user_role)
    || jsonb_build_object('tenant_name', tenant_name);

  -- 4. Actualizar claims dentro de event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;
