CREATE TABLE public.talleres (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id  uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  nombre     text                     NOT NULL,
  ubicacion  text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  valor_hora numeric(12,2)            DEFAULT 0 NOT NULL
);

CREATE INDEX talleres_tenant_id_idx ON public.talleres (tenant_id);

CREATE TRIGGER talleres_set_updated_at
  BEFORE UPDATE ON public.talleres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY tenant_access ON public.talleres
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.talleres
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_pkey PRIMARY KEY (id);

ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_valor_hora_check CHECK (valor_hora >= 0::numeric);

ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.talleres TO anon;

GRANT ALL ON public.talleres TO authenticated;

GRANT ALL ON public.talleres TO service_role;