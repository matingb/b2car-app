CREATE TABLE public.particulares (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  nombre      character varying(100)   NOT NULL,
  apellido    character varying(100)   NOT NULL,
  telefono    text,
  email       text,
  created_at  timestamp with time zone DEFAULT now(),
  direccion   text,
  codigo_pais text,
  dni_cuil    text,
  tenant_id   uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL
);

CREATE INDEX idx_personas_email ON public.particulares (email);

CREATE POLICY tenant_access ON public.particulares
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.particulares
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.particulares
  ADD CONSTRAINT particulares_dni_cuil_formato_valido CHECK (dni_cuil IS NULL OR dni_cuil ~ '^(?:[0-9]{7,8}|[0-9]{11})$'::text);

ALTER TABLE public.particulares
  ADD CONSTRAINT particulares_id_fkey FOREIGN KEY (id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.particulares
  ADD CONSTRAINT particulares_tenant_dni_cuil_unico UNIQUE (tenant_id, dni_cuil);

ALTER TABLE public.particulares
  ADD CONSTRAINT personas_pkey PRIMARY KEY (id);

ALTER TABLE public.particulares
  ADD CONSTRAINT particulares_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.particulares TO anon;

GRANT ALL ON public.particulares TO authenticated;

GRANT ALL ON public.particulares TO service_role;