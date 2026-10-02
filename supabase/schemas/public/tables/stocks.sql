CREATE TABLE "public"."stocks" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "taller_id"    uuid                     NOT NULL,
  "producto_id"  uuid                     NOT NULL,
  "cantidad"     integer                  NOT NULL DEFAULT 0,
  "stock_minimo" integer                  NOT NULL DEFAULT 0,
  "stock_maximo" integer                  NOT NULL DEFAULT 0,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stocks_cantidad_nonneg" CHECK ((cantidad >= 0)),
  CONSTRAINT "stocks_max_nonneg" CHECK ((stock_maximo >= 0)),
  CONSTRAINT "stocks_min_nonneg" CHECK ((stock_minimo >= 0)),
  CONSTRAINT "stocks_pkey" PRIMARY KEY (id),
  CONSTRAINT "stocks_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE,
  CONSTRAINT "stocks_taller_producto_unique_constraint" UNIQUE (taller_id, producto_id),
  CONSTRAINT "stocks_taller_id_fkey" FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE,
  "tenant_id"    uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "stocks_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE "public"."stocks"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX stocks_productoid_idx ON public.stocks USING btree (producto_id);

CREATE INDEX stocks_tallerid_idx ON public.stocks USING btree (taller_id);

CREATE TRIGGER stocks_set_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stocks" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stocks" TO "service_role";

CREATE INDEX stocks_tenant_id_idx ON public.stocks USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."stocks"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."stocks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stocks" TO "postgres";
