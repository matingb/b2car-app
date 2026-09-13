-- Evoluciona el POC fiscal para almacenar el par certificado/clave en un
-- bucket privado y mantener en Postgres solamente referencias y metadatos.

ALTER TABLE public.facturacion_configuracion_tenant
  ALTER COLUMN cert_subdirectory DROP NOT NULL,
  ALTER COLUMN cert_filename DROP NOT NULL,
  ALTER COLUMN key_filename DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS cert_storage_path text,
  ADD COLUMN IF NOT EXISTS key_storage_path text,
  ADD COLUMN IF NOT EXISTS cert_original_filename text,
  ADD COLUMN IF NOT EXISTS key_original_filename text,
  ADD COLUMN IF NOT EXISTS cert_fingerprint_sha256 text,
  ADD COLUMN IF NOT EXISTS cert_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credenciales_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS credenciales_updated_by uuid;

ALTER TABLE public.facturacion_configuracion_tenant
  DROP CONSTRAINT IF EXISTS facturacion_configuracion_credenciales_storage_completas,
  ADD CONSTRAINT facturacion_configuracion_credenciales_storage_completas CHECK (
    (
      cert_storage_path IS NULL
      AND key_storage_path IS NULL
      AND cert_original_filename IS NULL
      AND key_original_filename IS NULL
      AND cert_fingerprint_sha256 IS NULL
      AND cert_expires_at IS NULL
    )
    OR
    (
      NULLIF(btrim(cert_storage_path), '') IS NOT NULL
      AND NULLIF(btrim(key_storage_path), '') IS NOT NULL
      AND NULLIF(btrim(cert_original_filename), '') IS NOT NULL
      AND NULLIF(btrim(key_original_filename), '') IS NOT NULL
      AND cert_fingerprint_sha256 ~ '^[A-F0-9:]{95}$'
      AND cert_expires_at IS NOT NULL
    )
  );

-- Las configuraciones creadas con paths locales no pueden emitir hasta subir
-- un par al Storage. Los campos anteriores se conservan solo para permitir una
-- migracion gradual y dejan de ser leidos por la aplicacion.
UPDATE public.facturacion_configuracion_tenant
SET habilitada = false
WHERE cert_storage_path IS NULL OR key_storage_path IS NULL;

-- Crear el bucket es una operacion de configuracion; los objetos siempre se
-- administran mediante la API de Storage. Al no crear politicas para anon ni
-- authenticated, solo el backend con service_role puede acceder al contenido.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'facturacion-certificados',
  'facturacion-certificados',
  false,
  65536,
  NULL
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 65536,
    allowed_mime_types = NULL;
