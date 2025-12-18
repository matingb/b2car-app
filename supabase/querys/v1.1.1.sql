-- Modifica constraints para considerar tenant_id

ALTER TABLE public.vehiculos
ADD CONSTRAINT vehiculos_patente_tenant_unique
UNIQUE (patente, tenant_id);
