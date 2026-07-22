-- v1.10.0 - Catalogo de tipos de arreglo + columnas de tipo/empleado a nivel de linea.
-- Reemplaza al texto libre `arreglos.tipo` (que se elimina en una fase posterior,
-- una vez migrado todo el codigo). tipo_arreglo_id/empleado_id se agregan tanto a
-- detalle_arreglo (mano de obra) como a operaciones_lineas (repuestos asignados a
-- un arreglo), para permitir un desglose de estadisticas por linea.

CREATE TABLE IF NOT EXISTS public.tipos_arreglo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipos_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.tipos_arreglo OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_arreglo_tenant_nombre_lower
  ON public.tipos_arreglo (tenant_id, lower(nombre));

CREATE INDEX IF NOT EXISTS idx_tipos_arreglo_tenant_id ON public.tipos_arreglo USING btree (tenant_id);

CREATE OR REPLACE TRIGGER tipos_arreglo_set_updated_at
  BEFORE UPDATE ON public.tipos_arreglo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tipos_arreglo ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_access ON public.tipos_arreglo
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_arreglo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_arreglo TO service_role;

-- ===========================================================================
-- Lineas de mano de obra: tipo y empleado por linea.
-- ===========================================================================

ALTER TABLE public.detalle_arreglo
  ADD COLUMN IF NOT EXISTS tipo_arreglo_id uuid REFERENCES public.tipos_arreglo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_tipo_arreglo_id
  ON public.detalle_arreglo (tenant_id, tipo_arreglo_id);
CREATE INDEX IF NOT EXISTS idx_detalle_arreglo_empleado_id
  ON public.detalle_arreglo (tenant_id, empleado_id);

-- ===========================================================================
-- Lineas de repuestos asignados a un arreglo: mismos campos, simetrico.
-- Solo se completan para operaciones de tipo ASIGNACION_ARREGLO; el resto
-- (COMPRA/VENTA/AJUSTE) quedan en NULL.
-- ===========================================================================

ALTER TABLE public.operaciones_lineas
  ADD COLUMN IF NOT EXISTS tipo_arreglo_id uuid REFERENCES public.tipos_arreglo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS empleado_id uuid REFERENCES public.empleados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_tipo_arreglo_id
  ON public.operaciones_lineas (tipo_arreglo_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_lineas_empleado_id
  ON public.operaciones_lineas (empleado_id);

-- ===========================================================================
-- Arreglos: listas derivadas materializadas (GUIDs, no nombres denormalizados).
-- ===========================================================================

ALTER TABLE public.arreglos
  ADD COLUMN IF NOT EXISTS tipos uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS empleados uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_arreglos_tipos ON public.arreglos USING gin (tipos);
CREATE INDEX IF NOT EXISTS idx_arreglos_empleados ON public.arreglos USING gin (empleados);

-- ===========================================================================
-- Formularios custom: reemplazo del matching por texto contra `arreglos.tipo`.
-- ===========================================================================

ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS tipo_arreglo_id uuid REFERENCES public.tipos_arreglo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_formularios_tipo_arreglo_id ON public.formularios (tipo_arreglo_id);
