CREATE TABLE public.operaciones_gasto (
  operacion_id    uuid                     NOT NULL,
  tenant_id       uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  categoria_gasto text                     NOT NULL,
  descripcion     text,
  created_at      timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_op_gasto_tenant ON public.operaciones_gasto (tenant_id);

CREATE CONSTRAINT TRIGGER trg_gasto_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_gasto DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE POLICY tenant_access ON public.operaciones_gasto
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

ALTER TABLE public.operaciones_gasto
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_gasto
  ADD CONSTRAINT operaciones_gasto_categoria_check
    CHECK
    (categoria_gasto = ANY (ARRAY['ALQUILER'::text, 'SERVICIOS'::text, 'SUELDOS_HONORARIOS'::text, 'IMPUESTOS'::text, 'INSUMOS_REPUESTOS'::text, 'HERRAMIENTAS_EQUIPAMIENTO'::text,
    'MANTENIMIENTO'::text, 'SEGUROS'::text, 'TRANSPORTE_COMBUSTIBLE'::text, 'MARKETING_PUBLICIDAD'::text, 'COMISIONES_GASTOS_BANCARIOS'::text, 'OTROS'::text]));

ALTER TABLE public.operaciones_gasto
  ADD CONSTRAINT operaciones_gasto_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_gasto
  ADD CONSTRAINT operaciones_gasto_pkey PRIMARY KEY (operacion_id);

ALTER TABLE public.operaciones_gasto
  ADD CONSTRAINT operaciones_gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

GRANT SELECT ON public.operaciones_gasto TO authenticated;

GRANT ALL ON public.operaciones_gasto TO service_role;