CREATE TABLE public.facturacion_idempotencia_intenciones (
  tenant_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  factura_id uuid NOT NULL,
  contenido_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturacion_idempotencia_intenciones_pkey PRIMARY KEY (tenant_id, idempotency_key),
  CONSTRAINT facturacion_idempotencia_intenciones_hash_check CHECK (contenido_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT facturacion_idempotencia_intenciones_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT facturacion_idempotencia_intenciones_factura_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE
);
ALTER TABLE public.facturacion_idempotencia_intenciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY facturacion_idempotencia_tenant_select ON public.facturacion_idempotencia_intenciones
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY facturacion_idempotencia_tenant_insert ON public.facturacion_idempotencia_intenciones
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id = public.current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.facturas_electronicas f WHERE f.id = factura_id AND f.tenant_id = tenant_id
    ));
GRANT SELECT, INSERT ON public.facturacion_idempotencia_intenciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.facturacion_idempotencia_intenciones TO service_role;
