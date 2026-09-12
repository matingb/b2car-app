-- B2C-169: el identificador de particulares pertenece a su ficha, no al
-- perfil fiscal transitorio de clientes. La información fiscal se resuelve
-- en cada emisión mediante ARCA y queda preservada solamente en el snapshot
-- inmutable del comprobante autorizado.
ALTER TABLE public.particulares
  ADD COLUMN IF NOT EXISTS dni_cuil text;

-- Conserva los identificadores de particulares cargados antes de B2C-169,
-- siempre que puedan ser un DNI (7/8 dígitos) o CUIL (11 dígitos).
UPDATE public.particulares AS p
SET dni_cuil = regexp_replace(c.numero_documento_fiscal, '[^0-9]', '', 'g')
FROM public.clientes AS c
WHERE c.id = p.id
  AND c.tipo_cliente = 'particular'
  AND p.dni_cuil IS NULL
  AND NULLIF(regexp_replace(c.numero_documento_fiscal, '[^0-9]', '', 'g'), '') ~ '^(?:[0-9]{7,8}|[0-9]{11})$';

-- No se descarta ni se elige arbitrariamente una identidad si los datos
-- históricos incumplen la nueva regla de unicidad.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.particulares
    WHERE dni_cuil IS NOT NULL
    GROUP BY dni_cuil
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'No se puede aplicar B2C-169: existen DNI/CUIL duplicados entre particulares. Corregilos antes de continuar.';
  END IF;
END;
$$;

ALTER TABLE public.particulares
  DROP CONSTRAINT IF EXISTS particulares_dni_cuil_formato_valido,
  ADD CONSTRAINT particulares_dni_cuil_formato_valido CHECK (
    dni_cuil IS NULL OR dni_cuil ~ '^(?:[0-9]{7,8}|[0-9]{11})$'
  ),
  DROP CONSTRAINT IF EXISTS particulares_dni_cuil_unico,
  ADD CONSTRAINT particulares_dni_cuil_unico UNIQUE (dni_cuil);

-- La tabla clientes deja de almacenar documentación y condición fiscal. Esos
-- datos se obtienen desde ARCA al preparar y emitir cada comprobante.
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_documento_fiscal_valido,
  DROP CONSTRAINT IF EXISTS clientes_condicion_iva_receptor_valida,
  DROP COLUMN IF EXISTS tipo_documento_fiscal,
  DROP COLUMN IF EXISTS numero_documento_fiscal,
  DROP COLUMN IF EXISTS condicion_iva_receptor_id;
