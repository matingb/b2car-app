CREATE TABLE public.detalle_arreglo (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tenant_id             uuid                     DEFAULT ((auth.jwt() ->> 'tenant_id'::text))::uuid NOT NULL,
  arreglo_id            uuid                     NOT NULL,
  descripcion           text                     NOT NULL,
  cantidad              integer                  DEFAULT 1 NOT NULL,
  precio_hora_facturada numeric(12,2)            NOT NULL,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL,
  categoria_arreglo_id  uuid,
  empleado_id           uuid,
  iva_alicuota_id       smallint                 DEFAULT 5 NOT NULL,
  valor_hora_empleado   numeric(12,2),
  horas_facturadas      numeric(6,2)             DEFAULT 1,
  horas_trabajadas      numeric(6,2)             DEFAULT 1
);

CREATE INDEX idx_detalle_arreglo_arreglo_id ON public.detalle_arreglo (arreglo_id);

CREATE INDEX idx_detalle_arreglo_tenant_arreglo ON public.detalle_arreglo (tenant_id, arreglo_id);

CREATE INDEX idx_detalle_arreglo_categoria_arreglo_id ON public.detalle_arreglo (tenant_id, categoria_arreglo_id);

CREATE INDEX idx_detalle_arreglo_empleado_id ON public.detalle_arreglo (tenant_id, empleado_id);

CREATE TRIGGER detalle_arreglo_set_updated_at
  BEFORE UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER detalle_arreglo_snapshot_valores
  BEFORE INSERT OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._snapshot_detalle_arreglo_valores();

CREATE TRIGGER detalle_arreglo_sync_derivados
  AFTER INSERT OR DELETE OR UPDATE OF categoria_arreglo_id, empleado_id ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_detalle_arreglo_sync_derivados();

CREATE TRIGGER facturacion_proteger_detalle_arreglo
  BEFORE INSERT OR DELETE OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.facturacion_bloquear_mutacion_arreglo();

CREATE TRIGGER trigger_recalcular_precio_detalle_arreglo
  AFTER INSERT OR DELETE OR UPDATE ON public.detalle_arreglo
  FOR EACH ROW
  EXECUTE FUNCTION public.recalcular_precio_final_arreglo();

CREATE POLICY tenant_access ON public.detalle_arreglo
  TO authenticated
  USING ((tenant_id = public.current_tenant_id()))
  WITH CHECK ((tenant_id = public.current_tenant_id()));

COMMENT ON COLUMN public.detalle_arreglo.horas_facturadas IS 'NULL identifica horas históricas desconocidas; las nuevas líneas reciben default 1.';

ALTER TABLE public.detalle_arreglo
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_arreglo_id_fkey FOREIGN KEY (arreglo_id) REFERENCES public.arreglos(id) ON DELETE CASCADE;

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_cantidad_pos CHECK (cantidad > 0);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_categoria_arreglo_id_fkey FOREIGN KEY (categoria_arreglo_id) REFERENCES public.categorias_arreglo(id) ON DELETE SET NULL;

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_horas_facturadas_check CHECK (horas_facturadas >= 0::numeric);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_horas_trabajadas_check CHECK (horas_trabajadas >= 0::numeric);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_iva_alicuota_id_check CHECK (iva_alicuota_id = ANY (ARRAY[3, 4, 5, 6, 8, 9]));

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_pkey PRIMARY KEY (id);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_valor_hora_empleado_check CHECK (valor_hora_empleado IS NULL OR valor_hora_empleado >= 0::numeric);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_valor_nonneg CHECK (precio_hora_facturada >= 0::numeric);

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id) ON DELETE SET NULL;

ALTER TABLE public.detalle_arreglo
  ADD CONSTRAINT detalle_arreglo_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.detalle_arreglo TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.detalle_arreglo TO authenticated;

GRANT SELECT
  (arreglo_id, cantidad, categoria_arreglo_id, created_at, descripcion, empleado_id, horas_facturadas, horas_trabajadas, id, iva_alicuota_id, precio_hora_facturada, tenant_id,
  updated_at) ON public.detalle_arreglo TO authenticated;

GRANT ALL ON public.detalle_arreglo TO service_role;