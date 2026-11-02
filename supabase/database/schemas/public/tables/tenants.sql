CREATE TABLE public.tenants (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  nombre         character varying(255)   NOT NULL,
  estado         public.tenant_estado     DEFAULT 'activo'::public.tenant_estado NOT NULL,
  fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL,
  plan_sub       text                     DEFAULT 'BASE'::text NOT NULL
);

CREATE TRIGGER update_tenant_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenants
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants
  ADD CONSTRAINT fk_tenants_plan_sub FOREIGN KEY (plan_sub) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

GRANT ALL ON public.tenants TO anon;

GRANT ALL ON public.tenants TO authenticated;

GRANT ALL ON public.tenants TO service_role;