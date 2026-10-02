CREATE TABLE "public"."facturacion_emision_leases" (
  "emisor_cuit"      text                     NOT NULL,
  "punto_venta"      integer                  NOT NULL,
  "tipo_comprobante" smallint                 NOT NULL DEFAULT 11,
  "lease_token"      uuid                     NOT NULL,
  "expires_at"       timestamp with time zone NOT NULL,
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "facturacion_emision_leases_emisor_cuit_check" CHECK ((emisor_cuit ~ '^[0-9]{11}$'::text)),
  CONSTRAINT "facturacion_emision_leases_pkey" PRIMARY KEY (emisor_cuit, punto_venta, tipo_comprobante),
  CONSTRAINT "facturacion_emision_leases_punto_venta_check" CHECK ((punto_venta > 0))
);

ALTER TABLE "public"."facturacion_emision_leases"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_leases" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_leases" TO "service_role";

REVOKE ALL ON TABLE "public"."facturacion_emision_leases" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facturacion_emision_leases" TO "postgres";
