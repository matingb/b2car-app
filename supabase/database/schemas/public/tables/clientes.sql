CREATE TABLE public.clientes (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tipo_cliente         public.tipo_cliente,
  puntaje              integer                  DEFAULT 0,
  fecha_creacion       timestamp with time zone DEFAULT now(),
  tenant_id            uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  fce_mipyme_alcanzado boolean                  DEFAULT false NOT NULL
);

CREATE INDEX idx_clientes_tipo ON public.clientes (tipo_cliente);

CREATE INDEX idx_clientes_tenant_id ON public.clientes (tenant_id);

CREATE POLICY tenant_access ON public.clientes
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.clientes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_tipo_cliente_check CHECK (tipo_cliente::text = ANY (ARRAY['particular'::character varying::text, 'empresa'::character varying::text]));

ALTER TABLE public.clientes
  ADD CONSTRAINT fk_clientes_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT ALL ON public.clientes TO anon;

GRANT ALL ON public.clientes TO authenticated;

GRANT ALL ON public.clientes TO service_role;