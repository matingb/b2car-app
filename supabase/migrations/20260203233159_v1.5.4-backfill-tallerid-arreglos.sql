-- v1.5.4 - Backfill taller_id en arreglos (toma el primer taller por tenant)

WITH primer_taller AS (
	SELECT DISTINCT ON (t.tenant_id)
		t.tenant_id,
		t.id AS taller_id
	FROM public.talleres t
	ORDER BY t.tenant_id, t.created_at ASC, t.id ASC
)
UPDATE public.arreglos a
SET taller_id = pt.taller_id
FROM primer_taller pt
WHERE a.taller_id IS NULL
	AND a.tenant_id = pt.tenant_id;
