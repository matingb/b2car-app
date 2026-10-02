CREATE OR REPLACE FUNCTION public.dashboard_costo_por_categoria (
  top         integer                  DEFAULT 6,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH lineas AS (
    SELECT ol.categoria_arreglo_id AS cat_id, (ol.cantidad * p.costo_unitario)::numeric AS costo
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    JOIN public.stocks s ON s.id = ol.stock_id
    JOIN public.productos p ON p.id = s.producto_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT COALESCE(c.nombre, 'Sin categoría')::text AS label, COUNT(*)::int AS cantidad, COALESCE(SUM(l.costo), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto, ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn FROM agg
  ),
  top_rows AS (SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)),
  otros AS (SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0))
  SELECT s.label, s.cantidad, s.monto
  FROM (SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows UNION ALL SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_costo_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_costo_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_costo_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";
