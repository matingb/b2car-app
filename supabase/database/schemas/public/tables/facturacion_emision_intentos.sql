CREATE TABLE public.facturacion_emision_intentos (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  factura_id          uuid                     NOT NULL,
  numero_intento      integer                  NOT NULL,
  estado              text                     NOT NULL,
  candidato           jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  request_sanitizado  jsonb,
  response_sanitizada jsonb,
  error_codigo        text,
  error_mensaje       text,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  completed_at        timestamp with time zone
);

CREATE POLICY facturacion_intentos_insert_tenant ON public.facturacion_emision_intentos
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY facturacion_intentos_select_tenant ON public.facturacion_emision_intentos
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

CREATE POLICY facturacion_intentos_update_tenant ON public.facturacion_emision_intentos
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.facturas_electronicas f
  WHERE ((f.id = facturacion_emision_intentos.factura_id) AND (f.tenant_id = public.current_tenant_id())))));

ALTER TABLE public.facturacion_emision_intentos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturacion_emision_intentos
  ADD CONSTRAINT facturacion_emision_intentos_estado_check CHECK (estado = ANY (ARRAY['ENVIADO'::text, 'AUTORIZADO'::text, 'RECHAZADO'::text, 'INCIERTO'::text]));

ALTER TABLE public.facturacion_emision_intentos
  ADD CONSTRAINT facturacion_emision_intentos_numero_intento_check CHECK (numero_intento > 0);

ALTER TABLE public.facturacion_emision_intentos
  ADD CONSTRAINT facturacion_emision_intentos_numero_unico UNIQUE (factura_id, numero_intento);

ALTER TABLE public.facturacion_emision_intentos
  ADD CONSTRAINT facturacion_emision_intentos_pkey PRIMARY KEY (id);

ALTER TABLE public.facturacion_emision_intentos
  ADD CONSTRAINT facturacion_emision_intentos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas_electronicas(id) ON DELETE CASCADE;

GRANT INSERT, SELECT, UPDATE ON public.facturacion_emision_intentos TO authenticated;

GRANT ALL ON public.facturacion_emision_intentos TO service_role;