CREATE TABLE public.facturacion_idempotencia_intenciones (
  tenant_id       uuid                     NOT NULL,
  idempotency_key uuid                     NOT NULL,
  factura_id      uuid                     NOT NULL,
  contenido_hash  text                     NOT NULL,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

CREATE POLICY facturacion_idempotencia_tenant_select ON public.facturacion_idempotencia_intenciones
  FOR SELECT
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()));

CREATE POLICY facturacion_idempotencia_tenant_insert ON public.facturacion_idempotencia_intenciones
  FOR INSERT
  TO authenticated
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_idempotencia_intenciones.factura_id) AND (f.tenant_id = f.tenant_id))))));

ALTER TABLE public.facturacion_idempotencia_intenciones
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_idempotencia_intenciones
  ADD CONSTRAINT facturacion_idempotencia_intenciones_contenido_hash_check CHECK (contenido_hash ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE public.facturacion_idempotencia_intenciones
  ADD CONSTRAINT facturacion_idempotencia_intenciones_pkey PRIMARY KEY (tenant_id, idempotency_key);

ALTER TABLE public.facturacion_idempotencia_intenciones
  ADD CONSTRAINT facturacion_idempotencia_intenciones_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE;

ALTER TABLE public.facturacion_idempotencia_intenciones
  ADD CONSTRAINT facturacion_idempotencia_intenciones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

GRANT ALL ON public.facturacion_idempotencia_intenciones TO anon;

GRANT ALL ON public.facturacion_idempotencia_intenciones TO authenticated;

GRANT ALL ON public.facturacion_idempotencia_intenciones TO service_role;