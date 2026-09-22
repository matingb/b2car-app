-- Un cliente puede existir en varios tenants, pero una identidad no debe
-- repetirse dentro del mismo tenant. El tenant se replica en los detalles
-- para que Postgres pueda imponer esa regla con constraints declarativas.
ALTER TABLE public.empresas
  ADD COLUMN tenant_id uuid;

ALTER TABLE public.particulares
  ADD COLUMN tenant_id uuid;

UPDATE public.empresas AS empresa
SET tenant_id = cliente.tenant_id
FROM public.clientes AS cliente
WHERE cliente.id = empresa.id;

UPDATE public.particulares AS particular
SET tenant_id = cliente.tenant_id
FROM public.clientes AS cliente
WHERE cliente.id = particular.id;

ALTER TABLE public.empresas
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.particulares
  ALTER COLUMN tenant_id SET NOT NULL;

-- En nuevas inserciones de la aplicacion, el mismo claim del JWT que usa
-- clientes completa el tenant sin incluirlo en el request.
ALTER TABLE public.empresas
  ALTER COLUMN tenant_id SET DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid);

ALTER TABLE public.particulares
  ALTER COLUMN tenant_id SET DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid);

-- La relacion del detalle con su cliente ya esta cubierta por las FKs simples
-- existentes sobre id. Cada tenant del detalle referencia directamente al
-- tenant al que pertenece.
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id)
    ON DELETE RESTRICT;

ALTER TABLE public.particulares
  ADD CONSTRAINT particulares_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id)
    ON DELETE RESTRICT;

-- Falla antes de crear las constraints con un mensaje que permite ubicar los
-- datos que deben corregirse si ya hubiera duplicados en el mismo tenant.
DO $$
DECLARE
  duplicate_tenant_id uuid;
  duplicate_identifier text;
BEGIN
  SELECT tenant_id, cuit
  INTO duplicate_tenant_id, duplicate_identifier
  FROM public.empresas
  GROUP BY tenant_id, cuit
  HAVING count(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'No se puede aplicar la constraint: el CUIT % se repite en el tenant %',
      duplicate_identifier,
      duplicate_tenant_id
      USING ERRCODE = '23505';
  END IF;

  SELECT tenant_id, dni_cuil
  INTO duplicate_tenant_id, duplicate_identifier
  FROM public.particulares
  WHERE dni_cuil IS NOT NULL
  GROUP BY tenant_id, dni_cuil
  HAVING count(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'No se puede aplicar la constraint: el DNI/CUIL % se repite en el tenant %',
      duplicate_identifier,
      duplicate_tenant_id
      USING ERRCODE = '23505';
  END IF;
END;
$$;

-- Reemplaza la unicidad global introducida en B2C-169 por unicidad por tenant.
ALTER TABLE public.particulares
  DROP CONSTRAINT particulares_dni_cuil_unico,
  ADD CONSTRAINT particulares_tenant_dni_cuil_unico UNIQUE (tenant_id, dni_cuil);

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tenant_cuit_unico UNIQUE (tenant_id, cuit);

-- Reemplaza las politicas abiertas heredadas por aislamiento de filas por
-- tenant, igual que en las demas tablas que almacenan tenant_id.
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.particulares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_access ON public.empresas;
DROP POLICY IF EXISTS tenant_access ON public.empresas;
CREATE POLICY tenant_access ON public.empresas
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS auth_access ON public.particulares;
DROP POLICY IF EXISTS tenant_access ON public.particulares;
CREATE POLICY tenant_access ON public.particulares
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
