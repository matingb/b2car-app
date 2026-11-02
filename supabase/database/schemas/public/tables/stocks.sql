CREATE TABLE public.stocks (
  id                  uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id           uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  taller_id           uuid                     NOT NULL,
  producto_id         uuid                     NOT NULL,
  cantidad            integer                  DEFAULT 0 NOT NULL,
  stock_minimo        integer                  DEFAULT 0 NOT NULL,
  stock_maximo        integer                  DEFAULT 0 NOT NULL,
  created_at          timestamp with time zone DEFAULT now() NOT NULL,
  updated_at          timestamp with time zone DEFAULT now() NOT NULL,
  cantidad_reservada  integer                  DEFAULT 0 NOT NULL,
  cantidad_pendiente  integer                  DEFAULT 0 NOT NULL,
  cantidad_disponible integer                  GENERATED ALWAYS AS ((cantidad - cantidad_reservada)) STORED
);

CREATE INDEX stocks_tallerid_idx ON public.stocks (taller_id);

CREATE INDEX stocks_tenant_id_idx ON public.stocks (tenant_id);

CREATE INDEX stocks_productoid_idx ON public.stocks (producto_id);

CREATE TRIGGER stocks_set_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_stocks_proteger_saldos
  BEFORE INSERT OR UPDATE ON public.stocks
  FOR EACH ROW
  EXECUTE FUNCTION public._stocks_proteger_saldos();

CREATE POLICY tenant_access ON public.stocks
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.stocks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_cantidad_nonneg CHECK (cantidad >= 0);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_max_nonneg CHECK (stock_maximo >= 0);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_min_nonneg CHECK (stock_minimo >= 0);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_pendiente_nonneg CHECK (cantidad_pendiente >= 0);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_pkey PRIMARY KEY (id);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_reservada_nonneg CHECK (cantidad_reservada >= 0);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_taller_producto_unique_constraint UNIQUE (taller_id, producto_id);

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

ALTER TABLE public.stocks
  ADD CONSTRAINT stocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT ALL ON public.stocks TO anon;

GRANT ALL ON public.stocks TO authenticated;

GRANT ALL ON public.stocks TO service_role;