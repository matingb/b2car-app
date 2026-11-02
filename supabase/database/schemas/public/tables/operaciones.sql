CREATE TABLE public.operaciones (
  id            uuid                          DEFAULT gen_random_uuid() NOT NULL,
  tenant_id     uuid                          DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  tipo          public.tipo_operacion         NOT NULL,
  taller_id     uuid,
  created_at    timestamp with time zone      DEFAULT now() NOT NULL,
  fecha         timestamp with time zone      DEFAULT now() NOT NULL,
  observaciones text,
  monto_total   numeric(14,2)                 DEFAULT 0.00 NOT NULL,
  total_pagado  numeric(14,2)                 DEFAULT 0.00 NOT NULL,
  esta_pago     boolean                       DEFAULT false NOT NULL,
  estado_pago   public.estado_pago_operacion  DEFAULT 'PAGADO'::public.estado_pago_operacion NOT NULL,
  estado_stock  public.estado_stock_operacion DEFAULT 'ENTREGADO'::public.estado_stock_operacion NOT NULL
);

CREATE INDEX idx_operaciones_tenant_tipo_created ON public.operaciones (tenant_id, tipo, created_at DESC);

CREATE INDEX idx_operaciones_tenant ON public.operaciones (tenant_id);

CREATE INDEX idx_operaciones_tenant_fecha_created_id ON public.operaciones (tenant_id, fecha DESC, created_at DESC, id DESC);

CREATE INDEX idx_operaciones_fecha ON public.operaciones (fecha);

CREATE INDEX idx_operaciones_tenant_taller ON public.operaciones (tenant_id, taller_id);

CREATE TRIGGER facturacion_proteger_ajuste_devolucion_nc
  BEFORE DELETE OR UPDATE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc();

CREATE TRIGGER facturacion_proteger_operaciones
  BEFORE DELETE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER facturacion_proteger_venta_facturada
  BEFORE DELETE OR UPDATE ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

CREATE CONSTRAINT TRIGGER trg_operacion_validar_documento
  AFTER INSERT OR UPDATE ON public.operaciones DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE TRIGGER trg_operaciones_recalcular_pago
  BEFORE INSERT OR UPDATE OF monto_total, total_pagado ON public.operaciones
  FOR EACH ROW
  EXECUTE FUNCTION public._recalcular_estado_pago_operacion();

CREATE POLICY tenant_access ON public.operaciones
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK (((tenant_id = public.current_tenant_id()) AND ((taller_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.talleres t
  WHERE ((t.id = operaciones.taller_id) AND (t.tenant_id = public.current_tenant_id())))))));

ALTER TABLE public.operaciones
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_pkey PRIMARY KEY (id);

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_taller_requerido
    CHECK
    ((tipo <> ALL (ARRAY['COMPRA'::public.tipo_operacion, 'VENTA'::public.tipo_operacion, 'ASIGNACION_ARREGLO'::public.tipo_operacion, 'AJUSTE'::public.tipo_operacion])) OR
    taller_id IS NOT NULL);

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_tipo_no_movimiento_cuenta CHECK (tipo::text <> 'MOVIMIENTO_CUENTA'::text);

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_taller_id_fkey FOREIGN KEY (taller_id) REFERENCES public.talleres(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT SELECT ON public.operaciones TO authenticated;

GRANT ALL ON public.operaciones TO service_role;