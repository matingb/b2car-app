-- v1.7.1 - Formulario dinámico de arreglo: config + historial custom

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. formulario_arreglo_config
--    Define las líneas/campos del formulario dinámico por tenant.
--    Cada fila = un campo que se renderiza en el detalle del arreglo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.formularios (
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

CREATE INDEX IF NOT EXISTS idx_formularios_tenant
  ON public.formularios (tenant_id);

DROP TRIGGER IF EXISTS formularios_set_updated_at
  ON public.formularios;
CREATE TRIGGER formularios_set_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_access ON public.formularios;
CREATE POLICY tenant_access
  ON public.formularios
  TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. detalle_arreglo_formulario
--    Historial dinámico de valores guardados por arreglo.
--    Cada fila = un campo completado, generado a partir de la config.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.detalle_form_custom (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL
                               REFERENCES public.tenants(id)
                               DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  arreglo_id       uuid        NOT NULL
                               REFERENCES public.arreglos(id)
                               ON DELETE CASCADE,
  config_id        uuid                              
                               REFERENCES public.formularios(id)
                               ON DELETE SET NULL,
  costo            numeric(12,2) NOT NULL DEFAULT 0, 
  metadata         jsonb,                            
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detalle_form_custom_arreglo_id
  ON public.detalle_form_custom (arreglo_id);

CREATE INDEX IF NOT EXISTS idx_detalle_form_custom_tenant_arreglo
  ON public.detalle_form_custom (tenant_id, arreglo_id);

CREATE INDEX IF NOT EXISTS idx_detalle_form_custom_config_id
  ON public.detalle_form_custom (config_id);

DROP TRIGGER IF EXISTS detalle_form_custom_set_updated_at
  ON public.detalle_form_custom;
CREATE TRIGGER detalle_form_custom_set_updated_at
  BEFORE UPDATE ON public.detalle_form_custom
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.detalle_form_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_access ON public.detalle_form_custom;
CREATE POLICY tenant_access
  ON public.detalle_form_custom
  TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. vista_vehiculos_con_clientes
--    Incluye cliente_id para simplificar consumo desde provider de vehiculos.
CREATE OR REPLACE VIEW public.vista_vehiculos_con_clientes
WITH (security_invoker = on) AS
SELECT
  v.id,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.nombre, ' ', p.apellido)), ''),
    e.nombre
  )::text AS nombre_cliente,
  v.patente,
  v.marca,
  v.modelo,
  v.fecha_patente,
  v.nro_interno,
  v.numero_chasis,
  v.cliente_id
FROM public.vehiculos v
JOIN public.clientes c ON v.cliente_id = c.id
LEFT JOIN public.particulares p ON c.id = p.id
LEFT JOIN public.empresas e ON c.id = e.id;
