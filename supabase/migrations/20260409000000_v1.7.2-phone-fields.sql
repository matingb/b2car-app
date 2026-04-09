-- v1.7.2: Agregar código de país como campo separado al teléfono
-- Se agrega como nullable para compatibilidad con registros existentes.

ALTER TABLE "public"."particulares"
  ADD COLUMN IF NOT EXISTS "codigo_pais" text;

ALTER TABLE "public"."empresas"
  ADD COLUMN IF NOT EXISTS "codigo_pais" text;

ALTER TABLE "public"."representantes"
  ADD COLUMN IF NOT EXISTS "codigo_pais" text;
