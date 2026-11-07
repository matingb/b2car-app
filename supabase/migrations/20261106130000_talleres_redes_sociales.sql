-- Redes sociales del taller: se configuran en Configuración > Taller y pueden imprimirse
-- en el encabezado de las facturas del taller (debajo de la condición IVA del emisor).
-- Las columnas quedan cubiertas por los grants existentes a nivel tabla y por la política
-- tenant_access de public.talleres.

ALTER TABLE public.talleres
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text;

COMMENT ON COLUMN public.talleres.whatsapp IS 'Número de WhatsApp del taller, tal como se imprime en la factura.';
COMMENT ON COLUMN public.talleres.instagram IS 'Usuario de Instagram del taller, sin la @ inicial.';
COMMENT ON COLUMN public.talleres.facebook IS 'Nombre de la página de Facebook del taller.';

-- Mismos límites que valida la API (src/lib/redesSociales.ts); un valor vacío se guarda como NULL.
ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_whatsapp_valido
  CHECK (whatsapp IS NULL OR (whatsapp <> '' AND char_length(whatsapp) <= 30));

ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_instagram_valido
  CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$');

ALTER TABLE public.talleres
  ADD CONSTRAINT talleres_facebook_valido
  CHECK (facebook IS NULL OR (facebook <> '' AND char_length(facebook) <= 80));
