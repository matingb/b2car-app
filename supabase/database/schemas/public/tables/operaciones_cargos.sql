CREATE TABLE public.operaciones_cargos (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id         uuid                     NOT NULL,
  operacion_id      uuid                     NOT NULL,
  orden             integer                  NOT NULL,
  tipo              text                     NOT NULL,
  percepcion_codigo text,
  descripcion       text                     NOT NULL,
  importe           numeric(14,2)            NOT NULL,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  created_by        uuid                     DEFAULT auth.uid(),
  CONSTRAINT operaciones_cargos_pkey PRIMARY KEY (id),
  CONSTRAINT operaciones_cargos_operacion_id_fkey
    FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE,
  CONSTRAINT operaciones_cargos_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT operaciones_cargos_orden_key UNIQUE (operacion_id, orden),
  CONSTRAINT operaciones_cargos_tipo_check CHECK (tipo = ANY (ARRAY['PERCEPCION'::text])),
  CONSTRAINT operaciones_cargos_percepcion_check CHECK (
    tipo <> 'PERCEPCION'
    OR percepcion_codigo = ANY (ARRAY['GANANCIAS'::text, 'IVA'::text, 'IIBB_BUENOS_AIRES'::text, 'IIBB_CABA'::text, 'OTRA'::text])
  ),
  CONSTRAINT operaciones_cargos_descripcion_check CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 200),
  CONSTRAINT operaciones_cargos_importe_check CHECK (importe > 0)
);

CREATE INDEX idx_operaciones_cargos_tenant ON public.operaciones_cargos (tenant_id);

CREATE TRIGGER trg_operaciones_cargos_sync_totales
  AFTER INSERT OR DELETE OR UPDATE OF importe ON public.operaciones_cargos
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_recalcular_operacion();

ALTER TABLE public.operaciones_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY operaciones_cargos_select ON public.operaciones_cargos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public._b2c179_tiene_permiso('operaciones:view')
  );

REVOKE ALL ON public.operaciones_cargos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operaciones_cargos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operaciones_cargos TO service_role;
