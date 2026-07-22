-- v1.10.3 - Backfill de datos existentes hacia el catalogo de tipos_arreglo.
-- Ejecutado una sola vez. `operaciones_lineas` historicas quedan sin
-- tipo_arreglo_id/empleado_id (no hay dato previo del que migrarlas).

-- 1. Sembrar tipos_arreglo desde los valores distintos de arreglos.tipo.
INSERT INTO public.tipos_arreglo (tenant_id, nombre)
SELECT DISTINCT ON (a.tenant_id, lower(trim(a.tipo))) a.tenant_id, trim(a.tipo)
FROM public.arreglos a
WHERE a.tipo IS NOT NULL AND trim(a.tipo) <> ''
ORDER BY a.tenant_id, lower(trim(a.tipo)), a.created_at ASC
ON CONFLICT (tenant_id, lower(nombre)) DO NOTHING;

-- 2. Mapear cada detalle_arreglo historico al tipo de su arreglo padre.
UPDATE public.detalle_arreglo d
SET tipo_arreglo_id = t.id
FROM public.arreglos a
JOIN public.tipos_arreglo t
  ON t.tenant_id = a.tenant_id
 AND lower(t.nombre) = lower(trim(a.tipo))
WHERE d.arreglo_id = a.id
  AND d.tipo_arreglo_id IS NULL
  AND a.tipo IS NOT NULL
  AND trim(a.tipo) <> '';

-- 3. Mapear formularios.tipo_arreglo_id matcheando descripcion contra el tipo sembrado.
UPDATE public.formularios f
SET tipo_arreglo_id = t.id
FROM public.tipos_arreglo t
WHERE f.tenant_id = t.tenant_id
  AND lower(trim(f.descripcion)) = lower(t.nombre)
  AND f.tipo_arreglo_id IS NULL;

-- 4. Poblar tipos/empleados derivados de todos los arreglos existentes.
DO $$
DECLARE
  v_arreglo record;
BEGIN
  FOR v_arreglo IN SELECT id FROM public.arreglos LOOP
    PERFORM public._sync_arreglo_derivados(v_arreglo.id);
  END LOOP;
END;
$$;
