CREATE TABLE public.detalle_form_custom (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id  uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  arreglo_id uuid                     NOT NULL,
  config_id  uuid,
  costo      numeric(12,2)            DEFAULT 0 NOT NULL,
  metadata   jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_detalle_form_custom_config_id ON public.detalle_form_custom (config_id);

CREATE INDEX idx_detalle_form_custom_tenant_arreglo ON public.detalle_form_custom (tenant_id, arreglo_id);

CREATE INDEX idx_detalle_form_custom_arreglo_id ON public.detalle_form_custom (arreglo_id);

CREATE TRIGGER detalle_form_custom_set_updated_at
  BEFORE UPDATE ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER facturacion_proteger_detalle_form_custom
  BEFORE INSERT OR DELETE OR UPDATE ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trg_b2c197_recalcular_formulario
  AFTER INSERT OR DELETE OR UPDATE OF costo ON public.detalle_form_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

CREATE POLICY tenant_access ON public.detalle_form_custom
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.detalle_form_custom
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.detalle_form_custom
  ADD CONSTRAINT detalle_form_custom_arreglo_id_fkey FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE;

ALTER TABLE public.detalle_form_custom
  ADD CONSTRAINT detalle_form_custom_pkey PRIMARY KEY (id);

ALTER TABLE public.detalle_form_custom
  ADD CONSTRAINT detalle_form_custom_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.formularios(id) ON DELETE SET NULL;

ALTER TABLE public.detalle_form_custom
  ADD CONSTRAINT detalle_form_custom_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.detalle_form_custom TO anon;

GRANT ALL ON public.detalle_form_custom TO authenticated;

GRANT ALL ON public.detalle_form_custom TO service_role;