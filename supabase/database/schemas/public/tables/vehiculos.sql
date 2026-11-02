CREATE TABLE public.vehiculos (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  cliente_id    uuid                     NOT NULL,
  patente       text                     NOT NULL,
  marca         text                     NOT NULL,
  modelo        text                     NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  fecha_patente text,
  tenant_id     uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  nro_interno   text,
  numero_chasis text                     DEFAULT ''::text NOT NULL,
  color         text                     DEFAULT ''::text NOT NULL,
  numero_motor  text                     DEFAULT ''::text NOT NULL
);

CREATE INDEX idx_vehiculos_tenant_id ON public.vehiculos (tenant_id);

CREATE INDEX idx_vehiculos_cliente_id ON public.vehiculos (cliente_id);

CREATE INDEX idx_vehiculos_patente ON public.vehiculos (patente);

CREATE TRIGGER facturacion_proteger_vehiculos
  BEFORE UPDATE OF cliente_id ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trg_sync_vehiculo_cliente_id_to_arreglos
  AFTER UPDATE OF cliente_id ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_vehiculo_cliente_id_to_arreglos();

CREATE POLICY tenant_access ON public.vehiculos
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.vehiculos
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehiculos
  ADD CONSTRAINT fk_vehiculos_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.vehiculos
  ADD CONSTRAINT vehiculos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.vehiculos
  ADD CONSTRAINT vehiculos_patente_tenant_unique UNIQUE (patente, tenant_id);

ALTER TABLE public.vehiculos
  ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (id);

GRANT ALL ON public.vehiculos TO anon;

GRANT ALL ON public.vehiculos TO authenticated;

GRANT ALL ON public.vehiculos TO service_role;