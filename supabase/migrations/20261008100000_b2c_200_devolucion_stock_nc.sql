BEGIN;

CREATE TABLE public.facturacion_nc_devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  nota_credito_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  factura_original_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  operacion_linea_id uuid NOT NULL REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  operacion_ajuste_id uuid REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturacion_nc_devoluciones_nota_linea_unique UNIQUE (nota_credito_id, operacion_linea_id)
);

ALTER TABLE public.facturacion_nc_devoluciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX facturacion_nc_devoluciones_original_idx ON public.facturacion_nc_devoluciones (factura_original_id);
CREATE INDEX facturacion_nc_devoluciones_stock_idx ON public.facturacion_nc_devoluciones (stock_id);
CREATE POLICY facturacion_nc_devoluciones_read_tenant ON public.facturacion_nc_devoluciones
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
GRANT SELECT ON public.facturacion_nc_devoluciones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturacion_nc_devoluciones TO service_role;



CREATE OR REPLACE FUNCTION public.rpc_facturacion_reservar_devoluciones(p_nota_id uuid, p_devoluciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_linea_id uuid;
  v_cantidad integer;
  v_vendido integer;
  v_stock uuid;
  v_duplicate integer;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sesion sin tenant activo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.cliente_id = auth.uid() AND tm.tenant_id = v_tenant AND tm.rol = 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador del tenant puede reservar devoluciones';
  END IF;
  IF jsonb_typeof(COALESCE(p_devoluciones, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Devoluciones inválidas'; END IF;
  SELECT * INTO v_nota FROM public.facturas_electronicas WHERE id = p_nota_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' OR v_nota.estado <> 'ENVIANDO' THEN RAISE EXCEPTION 'Nota de crédito inválida para reservar devoluciones'; END IF;
  SELECT * INTO v_original FROM public.facturas_electronicas WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_original.origen_tipo <> 'VENTA' OR v_original.estado <> 'AUTORIZADA' THEN RAISE EXCEPTION 'La factura original no es una venta autorizada'; END IF;
  DELETE FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND operacion_ajuste_id IS NULL;
  SELECT count(*) INTO v_duplicate FROM (
    SELECT value->>'operacionLineaId' FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF v_duplicate > 0 THEN RAISE EXCEPTION 'No se puede repetir una línea de venta'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_linea_id := NULLIF(v_item->>'operacionLineaId','')::uuid;
    IF (v_item->>'cantidad') IS NULL OR (v_item->>'cantidad') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'La cantidad debe ser un entero no negativo'; END IF;
    v_cantidad := (v_item->>'cantidad')::integer;
    IF v_cantidad = 0 THEN CONTINUE; END IF;
    SELECT ol.stock_id, fel.cantidad::integer INTO v_stock, v_vendido
    FROM public.facturas_electronicas_lineas fel
    JOIN public.operaciones_lineas ol ON ol.id = fel.source_id
    JOIN public.operaciones o ON o.id = ol.operacion_id
    JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_tenant AND s.taller_id = o.taller_id
    WHERE fel.factura_id = v_original.id AND fel.origen = 'VENTA' AND fel.source_id = v_linea_id
      AND o.id = v_original.operacion_id AND o.tenant_id = v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la venta original'; END IF;
    IF v_cantidad > v_vendido - COALESCE((
      SELECT sum(d.cantidad) FROM public.facturacion_nc_devoluciones d
      JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
      WHERE d.factura_original_id = v_original.id AND d.operacion_linea_id = v_linea_id
        AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA') AND n.id <> p_nota_id
    ),0) THEN RAISE EXCEPTION 'La cantidad a devolver supera el saldo disponible'; END IF;
    INSERT INTO public.facturacion_nc_devoluciones(tenant_id, nota_credito_id, factura_original_id, operacion_linea_id, stock_id, cantidad)
    VALUES (v_tenant, p_nota_id, v_original.id, v_linea_id, v_stock, v_cantidad);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.rpc_facturacion_finalizar_nc(p_tenant_id uuid, p_nota_id uuid, p_cae text, p_cae_vencimiento date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_operacion uuid;
  v_taller uuid;
  v_item record;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Finalización reservada al servicio de facturación'; END IF;
  SELECT * INTO v_nota FROM public.facturas_electronicas WHERE id = p_nota_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN RAISE EXCEPTION 'Nota de crédito no encontrada'; END IF;
  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL) THEN
      RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar';
    END IF;
    RETURN p_nota_id;
  END IF;
  IF v_nota.estado NOT IN ('ENVIANDO','INCIERTA') OR p_cae IS NULL OR p_cae !~ '^[0-9]{14}$' OR p_cae_vencimiento IS NULL THEN RAISE EXCEPTION 'Datos de autorización inválidos'; END IF;
  SELECT * INTO v_original FROM public.facturas_electronicas WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura original no encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL) THEN
    IF v_original.origen_tipo <> 'VENTA' THEN RAISE EXCEPTION 'La factura original no es una venta'; END IF;
    SELECT s.taller_id INTO v_taller FROM public.facturacion_nc_devoluciones d JOIN public.stocks s ON s.id = d.stock_id
    WHERE d.nota_credito_id = p_nota_id LIMIT 1;
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d JOIN public.stocks s ON s.id = d.stock_id WHERE d.nota_credito_id = p_nota_id AND s.taller_id IS DISTINCT FROM v_taller) THEN
      RAISE EXCEPTION 'Las líneas de devolución pertenecen a talleres diferentes';
    END IF;
    INSERT INTO public.operaciones(tenant_id,tipo,taller_id,fecha) VALUES (v_tenant,'AJUSTE',v_taller,now()) RETURNING id INTO v_operacion;
    FOR v_item IN SELECT d.stock_id,sum(d.cantidad)::integer AS cantidad FROM public.facturacion_nc_devoluciones d WHERE d.nota_credito_id=p_nota_id AND d.cantidad>0 GROUP BY d.stock_id ORDER BY d.stock_id LOOP
      UPDATE public.stocks SET cantidad = cantidad + v_item.cantidad, updated_at=now() WHERE id=v_item.stock_id AND tenant_id=v_tenant;
      INSERT INTO public.operaciones_lineas(operacion_id,stock_id,cantidad,monto_unitario,delta_cantidad) VALUES (v_operacion,v_item.stock_id,v_item.cantidad,0,v_item.cantidad);
      UPDATE public.facturacion_nc_devoluciones SET operacion_ajuste_id=v_operacion WHERE nota_credito_id=p_nota_id AND stock_id=v_item.stock_id;
    END LOOP;
  END IF;
  UPDATE public.facturas_electronicas SET estado='AUTORIZADA',cae=p_cae,cae_vencimiento=p_cae_vencimiento,autorizada_at=now(),error_codigo=NULL,error_mensaje=NULL WHERE id=p_nota_id;
  RETURN p_nota_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) TO service_role;


CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'operaciones' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      RAISE EXCEPTION 'No se puede modificar un ajuste generado por una nota de crédito';
    END IF;
  ELSE
    v_id := COALESCE(NEW.operacion_id, OLD.operacion_id);
    IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE operacion_ajuste_id = v_id) THEN
      RAISE EXCEPTION 'No se pueden modificar líneas de un ajuste generado por una nota de crédito';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc() TO authenticated, service_role;


CREATE TRIGGER facturacion_proteger_ajuste_devolucion_nc BEFORE DELETE OR UPDATE ON public.operaciones FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc();

CREATE TRIGGER facturacion_proteger_lineas_ajuste_devolucion_nc BEFORE INSERT OR DELETE OR UPDATE ON public.operaciones_lineas FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_devolucion_nc();

CREATE OR REPLACE FUNCTION public.rpc_listar_operaciones_con_gastos (
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_tipos     text[]                   DEFAULT NULL::text[],
  p_page      integer                  DEFAULT 1,
  p_page_size integer                  DEFAULT 50
)
  RETURNS TABLE (
    id                       uuid,
    tipo                     text,
    taller_id                uuid,
    fecha                    timestamp with time zone,
    created_at               timestamp with time zone,
    lineas                   jsonb,
    gasto_id                 uuid,
    descripcion              text,
    categoria_gasto          text,
    cuenta_financiera_id     uuid,
    cuenta_financiera_nombre text,
    monto                    numeric,
    arreglo_id               uuid,
    total_count              bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  WITH rows AS (
    SELECT
      o.id,
      CASE
        WHEN oca.operacion_id IS NOT NULL THEN 'COBRO_ARREGLO'
        ELSE COALESCE(omc.subtipo, o.tipo::text)
      END AS tipo,
      o.taller_id, o.fecha, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id,
          'cantidad', l.cantidad, 'monto_unitario', l.monto_unitario,
          'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
          'nombre', p.nombre, 'codigo', p.codigo
        ) ORDER BY l.created_at, l.id)
        FROM public.operaciones_lineas AS l
        LEFT JOIN public.stocks AS s ON s.id = l.stock_id
        LEFT JOIN public.productos AS p ON p.id = s.producto_id
        WHERE l.operacion_id = o.id
      ), '[]'::jsonb) AS lineas,
      CASE WHEN omc.subtipo = 'GASTO' THEN o.id ELSE NULL END AS gasto_id,
      CASE
        WHEN o.tipo = 'ASIGNACION_ARREGLO' AND v.id IS NOT NULL THEN
          'Asignación · ' || TRIM(v.marca || ' ' || v.modelo) || ' (' || v.patente || ')'
        WHEN EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones d WHERE d.operacion_ajuste_id = o.id) THEN
          'Devolución por NC · ' || COALESCE((
            SELECT 'NC ' || COALESCE(n.numero_comprobante::text, n.id::text)
              || ' · Factura ' || COALESCE(f.numero_comprobante::text, f.id::text)
            FROM public.facturacion_nc_devoluciones d
            JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id
            JOIN public.facturas_electronicas f ON f.id = n.documento_asociado_id
            WHERE d.operacion_ajuste_id = o.id LIMIT 1
          ), '')
        ELSE omc.descripcion
      END AS descripcion,
      omc.categoria_gasto,
      COALESCE(omc.cuenta_id, omc.cuenta_origen_id, mf.cuenta_financiera_id) AS cuenta_financiera_id,
      COALESCE(cf_s.nombre, cf_o.nombre, cf_m.nombre) AS cuenta_financiera_nombre,
      COALESCE(
        abs(omc.importe),
        abs(mf.importe),
        (SELECT SUM(l.cantidad * l.monto_unitario) FROM public.operaciones_lineas AS l WHERE l.operacion_id = o.id)
      )::numeric AS monto,
      COALESCE(oca.arreglo_id, oaa.arreglo_id) AS arreglo_id
    FROM public.operaciones AS o
    LEFT JOIN public.operaciones_movimiento_cuenta AS omc ON omc.operacion_id = o.id
    LEFT JOIN LATERAL (
      SELECT m.cuenta_financiera_id, m.importe
      FROM public.movimientos_financieros AS m
      WHERE m.operacion_id = o.id AND m.tenant_id = o.tenant_id
      ORDER BY m.created_at, m.id
      LIMIT 1
    ) AS mf ON true
    LEFT JOIN public.operaciones_cobro_arreglo AS oca ON oca.operacion_id = o.id
    LEFT JOIN public.operaciones_asignacion_arreglo AS oaa ON oaa.operacion_id = o.id
    LEFT JOIN public.arreglos AS a ON a.id = COALESCE(oca.arreglo_id, oaa.arreglo_id)
    LEFT JOIN public.vehiculos AS v ON v.id = a.vehiculo_id
    LEFT JOIN public.cuentas_financieras AS cf_s ON cf_s.id = omc.cuenta_id
    LEFT JOIN public.cuentas_financieras AS cf_o ON cf_o.id = omc.cuenta_origen_id
    LEFT JOIN public.cuentas_financieras AS cf_m ON cf_m.id = mf.cuenta_financiera_id
    WHERE o.tenant_id = (SELECT public.current_tenant_id())
      AND (p_from IS NULL OR o.fecha >= p_from)
      AND (p_to IS NULL OR o.fecha < p_to)
  )
  SELECT r.*, COUNT(*) OVER() AS total_count
  FROM rows AS r
  WHERE COALESCE(cardinality(p_tipos), 0) = 0 OR r.tipo = ANY(p_tipos)
  ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_listar_operaciones_con_gastos"(timestamp WITH time zone, timestamp WITH time zone, text[], integer, integer) TO "postgres";


COMMIT;
