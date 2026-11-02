CREATE TABLE public.operaciones_lineas (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  operacion_id         uuid                     NOT NULL,
  cantidad             integer                  DEFAULT 0 NOT NULL,
  monto_unitario       numeric(12,2)            DEFAULT 0 NOT NULL,
  created_at           timestamp with time zone DEFAULT now() NOT NULL,
  stock_id             uuid                     NOT NULL,
  categoria_arreglo_id uuid,
  empleado_id          uuid,
  iva_alicuota_id      smallint                 DEFAULT 5 NOT NULL,
  cantidad_cumplida    integer                  DEFAULT 0 NOT NULL,
  sentido              smallint                 NOT NULL,
  cantidad_cancelada   integer                  DEFAULT 0 NOT NULL,
  delta_cantidad       integer                  GENERATED ALWAYS AS ((sentido * cantidad)) STORED
);

CREATE INDEX idx_operaciones_lineas_empleado_id ON public.operaciones_lineas (empleado_id);

CREATE INDEX idx_operaciones_lineas_abiertas ON public.operaciones_lineas (stock_id)
  WHERE (cantidad_cumplida + cantidad_cancelada) < cantidad;

CREATE UNIQUE INDEX uq_operaciones_lineas_operacion_stock ON public.operaciones_lineas (operacion_id, stock_id);

CREATE INDEX idx_operaciones_lineas_stock_id ON public.operaciones_lineas (stock_id);

CREATE INDEX idx_operaciones_lineas_categoria_arreglo_id ON public.operaciones_lineas (categoria_arreglo_id);

CREATE TRIGGER facturacion_proteger_lineas_ajuste_devolucion_nc
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc();

CREATE TRIGGER facturacion_proteger_lineas_venta_facturada
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_operacion_facturada();

CREATE TRIGGER facturacion_proteger_operaciones_lineas
  BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER operaciones_lineas_sync_derivados
  AFTER INSERT OR DELETE OR UPDATE OF categoria_arreglo_id, empleado_id ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_operaciones_lineas_sync_derivados();

CREATE TRIGGER trg_lineas_recalcular_stock
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, stock_id, cantidad_cancelada ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public._lineas_recalcular_stock();

CREATE CONSTRAINT TRIGGER trg_lineas_validar_documento
  AFTER INSERT OR DELETE OR UPDATE ON public.operaciones_lineas DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public._operacion_validar_documento();

CREATE TRIGGER trigger_recalcular_precio_operaciones_lineas
  AFTER INSERT OR DELETE OR UPDATE OF cantidad, monto_unitario, stock_id, iva_alicuota_id ON public.operaciones_lineas
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

CREATE POLICY tenant_access ON public.operaciones_lineas
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.operaciones o
  WHERE ((o.id = operaciones_lineas.operacion_id) AND (o.tenant_id = public.current_tenant_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.operaciones o
     JOIN public.stocks s ON ((s.id = operaciones_lineas.stock_id)))
  WHERE
    ((o.id = operaciones_lineas.operacion_id) AND (o.tenant_id = public.current_tenant_id()) AND (s.tenant_id = public.current_tenant_id()) AND ((o.taller_id IS NULL) OR
    (s.taller_id = o.taller_id))))));

ALTER TABLE public.operaciones_lineas
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_cancelada_nonneg CHECK (cantidad_cancelada >= 0);

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_categoria_arreglo_id_fkey FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_cumplida_cancelada_pactada CHECK ((cantidad_cumplida + cantidad_cancelada) <= cantidad);

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_cumplida_nonneg CHECK (cantidad_cumplida >= 0);

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE SET NULL;

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_iva_alicuota_id_check CHECK (iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]));

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_pkey PRIMARY KEY (id);

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_sentido_check CHECK (sentido = ANY (ARRAY['-1'::integer, 1]));

ALTER TABLE public.operaciones_lineas
  ADD CONSTRAINT operaciones_lineas_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.stocks(id) ON DELETE CASCADE;

GRANT SELECT ON public.operaciones_lineas TO authenticated;

GRANT ALL ON public.operaciones_lineas TO service_role;