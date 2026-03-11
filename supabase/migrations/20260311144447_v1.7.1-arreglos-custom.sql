-- v1.7.1 - Formulario dinámico de arreglo: config + historial custom

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. formulario_arreglo_config
--    Define las líneas/campos del formulario dinámico por tenant.
--    Cada fila = un campo que se renderiza en el detalle del arreglo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.formulario_arreglo_config (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL
                               REFERENCES public.tenants(id)
                               DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,

  descripcion      text        NOT NULL,
  costoDefault            numeric(12,2) NOT NULL DEFAULT 0,
  metadata         jsonb,                            
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formulario_arreglo_config_tenant
  ON public.formulario_arreglo_config (tenant_id);

DROP TRIGGER IF EXISTS formulario_arreglo_config_set_updated_at
  ON public.formulario_arreglo_config;
CREATE TRIGGER formulario_arreglo_config_set_updated_at
  BEFORE UPDATE ON public.formulario_arreglo_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.formulario_arreglo_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_access ON public.formulario_arreglo_config;
CREATE POLICY tenant_access
  ON public.formulario_arreglo_config
  TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. detalle_arreglo_formulario
--    Historial dinámico de valores guardados por arreglo.
--    Cada fila = un campo completado, generado a partir de la config.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.detalle_arreglo_formulario (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL
                               REFERENCES public.tenants(id)
                               DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  arreglo_id       uuid        NOT NULL
                               REFERENCES public.arreglos(id)
                               ON DELETE CASCADE,
  config_id        uuid                              
                               REFERENCES public.formulario_arreglo_config(id)
                               ON DELETE SET NULL,
  costo            numeric(12,2) NOT NULL DEFAULT 0, 
  metadata         jsonb,                            
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_formulario_arreglo_id
  ON public.detalle_arreglo_formulario (arreglo_id);

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_formulario_tenant_arreglo
  ON public.detalle_arreglo_formulario (tenant_id, arreglo_id);

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_formulario_config_id
  ON public.detalle_arreglo_formulario (config_id);

DROP TRIGGER IF EXISTS detalle_arreglo_formulario_set_updated_at
  ON public.detalle_arreglo_formulario;
CREATE TRIGGER detalle_arreglo_formulario_set_updated_at
  BEFORE UPDATE ON public.detalle_arreglo_formulario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.detalle_arreglo_formulario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_access ON public.detalle_arreglo_formulario;
CREATE POLICY tenant_access
  ON public.detalle_arreglo_formulario
  TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
