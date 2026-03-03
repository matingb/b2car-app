DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'tenant_estado'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.tenant_estado AS ENUM ('activo', 'suspendido');
  END IF;
END $$;

DO $$
DECLARE
  v_is_enum boolean;
BEGIN
  SELECT c.udt_name = 'tenant_estado'
    INTO v_is_enum
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'tenants'
    AND c.column_name = 'estado';

  IF COALESCE(v_is_enum, false) THEN
    RETURN;
  END IF;

  UPDATE public.tenants
  SET estado = CASE
    WHEN lower(estado) = 'activo' THEN 'activo'
    ELSE 'suspendido'
  END;

  ALTER TABLE public.tenants
    ALTER COLUMN estado DROP DEFAULT,
    ALTER COLUMN estado TYPE public.tenant_estado
      USING (
        CASE
          WHEN lower(estado) = 'activo' THEN 'activo'::public.tenant_estado
          ELSE 'suspendido'::public.tenant_estado
        END
      ),
    ALTER COLUMN estado SET DEFAULT 'activo'::public.tenant_estado,
    ALTER COLUMN estado SET NOT NULL;
END $$;
