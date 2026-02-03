-- v1.5.3 - Migrar descripción de arreglos a detalle_arreglo
-- Separa por "+", "," o salto de línea. Primera línea lleva precio_final; resto 0.
-- Solo afecta arreglos que aún no tienen detalle.

-- =============================================================================
-- INSERT: crear filas en detalle_arreglo solo para arreglos sin detalle.
-- =============================================================================
INSERT INTO public.detalle_arreglo (
  tenant_id,
  arreglo_id,
  descripcion,
  cantidad,
  valor,
  created_at,
  updated_at
)
SELECT
  a.tenant_id,
  a.id AS arreglo_id,
  trim(part) AS descripcion,
  1 AS cantidad,
  CASE WHEN row_number() OVER (PARTITION BY a.id ORDER BY ord) = 1
    THEN COALESCE(a.precio_final, 0)
    ELSE 0
  END AS valor,
  a.created_at,
  a.created_at AS updated_at
FROM public.arreglos a
CROSS JOIN LATERAL unnest(
  regexp_split_to_array(COALESCE(a.descripcion, ''), '\s*[+\n\r,]+\s*')
) WITH ORDINALITY AS t(part, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.detalle_arreglo d WHERE d.arreglo_id = a.id);

-- Si el arreglo tenía descripción vacía/null, regexp_split_to_array da un solo
-- elemento '' y ya se inserta una línea. Si por algún caso el array quedara
-- vacío, no insertaríamos nada para ese arreglo; con COALESCE('') el array
-- siempre tiene al menos un elemento.