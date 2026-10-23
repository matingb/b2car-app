CREATE TABLE "public"."operaciones_pagos" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            uuid                     NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  "operacion_id"         uuid                     NOT NULL,
  "operacion_pago_id"    uuid,
  "cuenta_financiera_id" uuid                     NOT NULL,
  "monto"                numeric(14,2)            NOT NULL,
  "fecha"                timestamp with time zone NOT NULL DEFAULT now(),
  "descripcion"          text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"           uuid,
  CONSTRAINT "operaciones_pagos_pkey" PRIMARY KEY (id),
  CONSTRAINT "operaciones_pagos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_pagos_operacion_id_fkey" FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_pagos_operacion_pago_id_fkey" FOREIGN KEY (operacion_pago_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT "operaciones_pagos_cuenta_fkey" FOREIGN KEY (cuenta_financiera_id) REFERENCES public.cuentas_financieras(id) ON DELETE RESTRICT,
  CONSTRAINT "operaciones_pagos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "operaciones_pagos_monto_check" CHECK ((monto > 0))
);

ALTER TABLE "public"."operaciones_pagos" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_operaciones_pagos_operacion_id ON public.operaciones_pagos USING btree (operacion_id);
CREATE INDEX idx_operaciones_pagos_pago_id ON public.operaciones_pagos USING btree (operacion_pago_id);
CREATE INDEX idx_operaciones_pagos_tenant ON public.operaciones_pagos USING btree (tenant_id);

CREATE POLICY "tenant_access" ON "public"."operaciones_pagos"
  FOR ALL
  TO "authenticated"
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."operaciones_pagos" TO "anon", "authenticated", "service_role";
