CREATE TABLE "public"."clientes" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "puntaje"              integer                  DEFAULT 0,
  "fecha_creacion"       timestamp with time zone DEFAULT now(),
  "fce_mipyme_alcanzado" boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "clientes_pkey" PRIMARY KEY (id),
  "tenant_id"            uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  CONSTRAINT "fk_clientes_tenant" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."clientes"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clientes"
  ADD COLUMN "tipo_cliente" public.tipo_cliente;

ALTER TABLE "public"."clientes"
  ADD CONSTRAINT "clientes_tipo_cliente_check" CHECK (((tipo_cliente)::text = ANY (ARRAY[('particular'::character varying)::text, ('empresa'::character varying)::text])));

CREATE INDEX idx_clientes_tipo ON public.clientes USING btree (tipo_cliente);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "service_role";

CREATE INDEX idx_clientes_tenant_id ON public.clientes USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."clientes"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

REVOKE ALL ON TABLE "public"."clientes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes" TO "postgres";
