-- B2C-200 v2: immutable fiscal stock provenance snapshots.
ALTER TABLE public.facturas_electronicas
  ADD COLUMN IF NOT EXISTS stock_origenes_hash text;

CREATE TABLE IF NOT EXISTS public.facturacion_factura_stock_origenes (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  factura_id uuid NOT NULL REFERENCES public.facturas_electronicas(id) ON DELETE RESTRICT,
  operacion_linea_id uuid NOT NULL REFERENCES public.operaciones_lineas(id) ON DELETE RESTRICT,
  operacion_origen_id uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE RESTRICT,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE RESTRICT,
  taller_id uuid NOT NULL REFERENCES public.talleres(id) ON DELETE RESTRICT,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  origen_linea text NOT NULL CHECK (origen_linea IN ('VENTA','REPUESTO')),
  cantidad_original integer NOT NULL CHECK (cantidad_original > 0),
  nombre_snapshot text NOT NULL,
  codigo_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturacion_factura_stock_origenes_pkey PRIMARY KEY (factura_id, operacion_linea_id)
);
CREATE INDEX IF NOT EXISTS facturacion_stock_origenes_linea_idx ON public.facturacion_factura_stock_origenes (operacion_linea_id);
CREATE INDEX IF NOT EXISTS facturacion_stock_origenes_stock_idx ON public.facturacion_factura_stock_origenes (stock_id);
CREATE INDEX IF NOT EXISTS facturacion_stock_origenes_tenant_factura_idx ON public.facturacion_factura_stock_origenes (tenant_id, factura_id);
ALTER TABLE public.facturacion_factura_stock_origenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS facturacion_stock_origenes_read_tenant ON public.facturacion_factura_stock_origenes;
CREATE POLICY facturacion_stock_origenes_read_tenant ON public.facturacion_factura_stock_origenes
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
REVOKE ALL ON public.facturacion_factura_stock_origenes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facturacion_factura_stock_origenes TO authenticated;
GRANT SELECT ON public.facturacion_factura_stock_origenes TO service_role;
REVOKE ALL ON public.facturacion_factura_stock_origenes FROM postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturacion_factura_stock_origenes TO postgres;

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.facturas_electronicas f WHERE f.id=OLD.factura_id AND f.estado='AUTORIZADA') THEN
      RAISE EXCEPTION 'El snapshot de origen autorizado es inmutable';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Los snapshots de origen no se modifican';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas_electronicas f WHERE f.id=NEW.factura_id AND (f.documento_tipo <> 'FACTURA' OR f.estado='AUTORIZADA')) THEN
    RAISE EXCEPTION 'No se puede insertar snapshot para este documento';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.facturacion_bloquear_mutacion_stock_origenes() TO postgres, service_role;
DROP TRIGGER IF EXISTS facturacion_stock_origenes_inmutables ON public.facturacion_factura_stock_origenes;
CREATE TRIGGER facturacion_stock_origenes_inmutables BEFORE INSERT OR UPDATE OR DELETE ON public.facturacion_factura_stock_origenes
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes();


-- Backfill only source-linked detailed invoices. Simplified historical invoices are deliberately left unverified.
DROP TRIGGER IF EXISTS facturacion_stock_origenes_inmutables ON public.facturacion_factura_stock_origenes;
INSERT INTO public.facturacion_factura_stock_origenes (
  tenant_id, factura_id, operacion_linea_id, operacion_origen_id, stock_id, taller_id, producto_id,
  origen_linea, cantidad_original, nombre_snapshot, codigo_snapshot
)
SELECT f.tenant_id, f.id, ol.id, o.id, s.id, s.taller_id, s.producto_id,
  fel.origen, abs(ol.delta_cantidad)::integer, fel.descripcion, fel.codigo
FROM public.facturas_electronicas f
JOIN public.facturas_electronicas_lineas fel ON fel.factura_id = f.id
JOIN public.operaciones_lineas ol ON ol.id = fel.source_id AND ol.delta_cantidad < 0
JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tenant_id = f.tenant_id
JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = f.tenant_id AND s.taller_id = o.taller_id
JOIN public.productos p ON p.id = s.producto_id AND p.tenant_id = f.tenant_id
WHERE f.documento_tipo = 'FACTURA' AND f.estado = 'AUTORIZADA'
  AND COALESCE(fel.snapshot->>'detalleSimplificado', 'false') <> 'true'
  AND ol.cantidad = abs(ol.delta_cantidad)
  AND fel.cantidad = abs(ol.delta_cantidad)::numeric
  AND ((f.origen_tipo = 'VENTA' AND fel.origen = 'VENTA' AND o.id = f.operacion_id AND o.tipo = 'VENTA')
    OR (f.origen_tipo = 'ARREGLO' AND fel.origen = 'REPUESTO' AND o.tipo = 'ASIGNACION_ARREGLO'
      AND EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo oa WHERE oa.operacion_id = o.id AND oa.arreglo_id = f.arreglo_id)))
ON CONFLICT (factura_id, operacion_linea_id) DO NOTHING;

-- A detailed historical invoice is marked verified only if every physical source line
-- and every physical fiscal line has an exact snapshot. Hidden/zero-price or simplified
-- lines therefore remain fiscal-only until separately audited.
WITH expected AS (
  SELECT f.id AS factura_id, f.tenant_id, ol.id AS operacion_linea_id, o.id AS operacion_origen_id,
    ol.stock_id, s.taller_id, s.producto_id, 'VENTA'::text AS origen_linea, abs(ol.delta_cantidad)::integer AS cantidad_original
  FROM public.facturas_electronicas f
  JOIN public.operaciones o ON o.id = f.operacion_id AND o.tenant_id = f.tenant_id AND o.tipo = 'VENTA'
  JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id AND ol.delta_cantidad < 0
  JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = f.tenant_id AND s.taller_id = o.taller_id
  WHERE f.documento_tipo = 'FACTURA' AND f.estado = 'AUTORIZADA' AND f.origen_tipo = 'VENTA'
  UNION ALL
  SELECT f.id, f.tenant_id, ol.id, o.id, ol.stock_id, s.taller_id, s.producto_id,
    'REPUESTO'::text, abs(ol.delta_cantidad)::integer
  FROM public.facturas_electronicas f
  JOIN public.operaciones_asignacion_arreglo oa ON oa.arreglo_id = f.arreglo_id
  JOIN public.operaciones o ON o.id = oa.operacion_id AND o.tenant_id = f.tenant_id AND o.tipo = 'ASIGNACION_ARREGLO'
  JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id AND ol.delta_cantidad < 0
  JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = f.tenant_id AND s.taller_id = o.taller_id
  WHERE f.documento_tipo = 'FACTURA' AND f.estado = 'AUTORIZADA' AND f.origen_tipo = 'ARREGLO'
), eligible AS (
  SELECT f.id AS factura_id
  FROM public.facturas_electronicas f
  WHERE f.documento_tipo = 'FACTURA' AND f.estado = 'AUTORIZADA'
    AND f.stock_origenes_hash IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.facturas_electronicas_lineas sf WHERE sf.factura_id=f.id AND COALESCE(sf.snapshot->>'detalleSimplificado','false')='true')
    AND (f.origen_tipo = 'VENTA' OR (f.origen_tipo = 'ARREGLO' AND EXISTS (SELECT 1 FROM expected e WHERE e.factura_id=f.id)))
    AND NOT EXISTS (
      SELECT 1 FROM expected e WHERE e.factura_id=f.id AND NOT EXISTS (
        SELECT 1 FROM public.facturacion_factura_stock_origenes sfo
        WHERE sfo.factura_id=e.factura_id AND sfo.operacion_linea_id=e.operacion_linea_id
          AND sfo.operacion_origen_id=e.operacion_origen_id AND sfo.stock_id=e.stock_id
          AND sfo.taller_id=e.taller_id AND sfo.producto_id=e.producto_id
          AND sfo.origen_linea=e.origen_linea AND sfo.cantidad_original=e.cantidad_original
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas_lineas fel
      WHERE fel.factura_id=f.id AND fel.origen IN ('VENTA','REPUESTO') AND fel.source_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.facturacion_factura_stock_origenes sfo
          WHERE sfo.factura_id=f.id AND sfo.operacion_linea_id=fel.source_id)
    )
)
UPDATE public.facturas_electronicas f
SET stock_origenes_hash = 'backfill-v1:' || md5(COALESCE((
  SELECT string_agg(sfo.operacion_linea_id::text || ':' || sfo.cantidad_original::text, '|' ORDER BY sfo.operacion_linea_id)
  FROM public.facturacion_factura_stock_origenes sfo WHERE sfo.factura_id=f.id
), 'empty'))
WHERE f.id IN (SELECT factura_id FROM eligible);

CREATE TRIGGER facturacion_stock_origenes_inmutables BEFORE INSERT OR UPDATE OR DELETE ON public.facturacion_factura_stock_origenes
FOR EACH ROW EXECUTE FUNCTION public.facturacion_bloquear_mutacion_stock_origenes();


-- Atomically persist and verify canonical stock provenance while preparing a FACTURA.
CREATE OR REPLACE FUNCTION public.rpc_facturacion_preparar_documento (
  p_encabezado jsonb,
  p_lineas     jsonb,
  p_factura_id uuid  DEFAULT NULL::uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_id uuid := COALESCE(p_factura_id, gen_random_uuid());
  v_estado text;
  v_tenant_id uuid;
  v_current_tenant uuid := public.current_tenant_id();
  v_stock_origenes jsonb := '[]'::jsonb;
  v_stock_origenes_hash text;
BEGIN
  IF v_current_tenant IS NULL THEN
    RAISE EXCEPTION 'Sesion sin tenant activo';
  END IF;
  IF jsonb_typeof(p_encabezado) <> 'object' OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Documento fiscal invalido';
  END IF;
  -- Aislamiento estricto de tenant en el encabezado
  IF (p_encabezado->>'tenant_id')::uuid IS DISTINCT FROM v_current_tenant THEN
    RAISE EXCEPTION 'Tenant no autorizado para este documento';
  END IF;
  -- Validar que entidades asociadas pertenezcan al mismo tenant
  IF NULLIF(p_encabezado->>'arreglo_id', '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.arreglos
      WHERE id = (p_encabezado->>'arreglo_id')::uuid AND tenant_id = v_current_tenant
    ) THEN
      RAISE EXCEPTION 'El arreglo no pertenece al tenant activo';
    END IF;
  END IF;
  IF NULLIF(p_encabezado->>'operacion_id', '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operaciones
      WHERE id = (p_encabezado->>'operacion_id')::uuid AND tenant_id = v_current_tenant
    ) THEN
      RAISE EXCEPTION 'La operacion no pertenece al tenant activo';
    END IF;
  END IF;
  IF NULLIF(p_encabezado->>'documento_asociado_id', '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.facturas_electronicas
      WHERE id = (p_encabezado->>'documento_asociado_id')::uuid AND tenant_id = v_current_tenant
    ) THEN
      RAISE EXCEPTION 'El documento asociado no pertenece al tenant activo';
    END IF;
  END IF;
  IF p_encabezado->>'documento_tipo' = 'FACTURA' THEN
    IF p_encabezado->>'origen_tipo' = 'VENTA' THEN
      IF NULLIF(p_encabezado->>'operacion_id','') IS NULL OR NULLIF(p_encabezado->>'arreglo_id','') IS NOT NULL THEN
        RAISE EXCEPTION 'Origen de venta inválido';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.operaciones o
        JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
        WHERE o.id = (p_encabezado->>'operacion_id')::uuid AND o.tenant_id = v_current_tenant
          AND o.tipo = 'VENTA' AND ol.delta_cantidad < 0 AND ol.cantidad <> abs(ol.delta_cantidad)
      ) THEN RAISE EXCEPTION 'La salida de stock de la venta no coincide con la cantidad de la línea'; END IF;
      PERFORM 1
      FROM public.operaciones o
      JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
      JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_current_tenant AND s.taller_id = o.taller_id
      WHERE o.id = (p_encabezado->>'operacion_id')::uuid
        AND o.tenant_id = v_current_tenant AND o.tipo = 'VENTA' AND ol.delta_cantidad < 0
      ORDER BY ol.id FOR UPDATE OF o, ol, s;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'operacion_linea_id', ol.id,
        'operacion_origen_id', o.id,
        'stock_id', s.id,
        'taller_id', s.taller_id,
        'producto_id', s.producto_id,
        'origen_linea', 'VENTA',
        'cantidad_original', abs(ol.delta_cantidad),
        'nombre_snapshot', p.nombre,
        'codigo_snapshot', p.codigo
      ) ORDER BY ol.id), '[]'::jsonb)
      INTO v_stock_origenes
      FROM public.operaciones o
      JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
      JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_current_tenant AND s.taller_id = o.taller_id
      JOIN public.productos p ON p.id = s.producto_id AND p.tenant_id = v_current_tenant
      WHERE o.id = (p_encabezado->>'operacion_id')::uuid
        AND o.tenant_id = v_current_tenant AND o.tipo = 'VENTA' AND ol.delta_cantidad < 0;
    ELSIF p_encabezado->>'origen_tipo' = 'ARREGLO' THEN
      IF NULLIF(p_encabezado->>'arreglo_id','') IS NULL OR NULLIF(p_encabezado->>'operacion_id','') IS NOT NULL THEN
        RAISE EXCEPTION 'Origen de arreglo inválido';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.operaciones_asignacion_arreglo oa
        JOIN public.operaciones o ON o.id = oa.operacion_id AND o.tenant_id = v_current_tenant AND o.tipo = 'ASIGNACION_ARREGLO'
        JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
        WHERE oa.arreglo_id = (p_encabezado->>'arreglo_id')::uuid AND ol.delta_cantidad < 0
          AND ol.cantidad <> abs(ol.delta_cantidad)
      ) THEN RAISE EXCEPTION 'La salida de stock del arreglo no coincide con la cantidad de la línea'; END IF;
      PERFORM 1
      FROM public.operaciones_asignacion_arreglo oa
      JOIN public.operaciones o ON o.id = oa.operacion_id AND o.tenant_id = v_current_tenant AND o.tipo = 'ASIGNACION_ARREGLO'
      JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
      JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_current_tenant AND s.taller_id = o.taller_id
      WHERE oa.arreglo_id = (p_encabezado->>'arreglo_id')::uuid AND ol.delta_cantidad < 0
      ORDER BY ol.id FOR UPDATE OF o, ol, s;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'operacion_linea_id', ol.id,
        'operacion_origen_id', o.id,
        'stock_id', s.id,
        'taller_id', s.taller_id,
        'producto_id', s.producto_id,
        'origen_linea', 'REPUESTO',
        'cantidad_original', abs(ol.delta_cantidad),
        'nombre_snapshot', p.nombre,
        'codigo_snapshot', p.codigo
      ) ORDER BY ol.id), '[]'::jsonb)
      INTO v_stock_origenes
      FROM public.operaciones_asignacion_arreglo oa
      JOIN public.operaciones o ON o.id = oa.operacion_id AND o.tenant_id = v_current_tenant AND o.tipo = 'ASIGNACION_ARREGLO'
      JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
      JOIN public.stocks s ON s.id = ol.stock_id AND s.tenant_id = v_current_tenant AND s.taller_id = o.taller_id
      JOIN public.productos p ON p.id = s.producto_id AND p.tenant_id = v_current_tenant
      WHERE oa.arreglo_id = (p_encabezado->>'arreglo_id')::uuid AND ol.delta_cantidad < 0;
    ELSE
      RAISE EXCEPTION 'Origen físico de factura no soportado';
    END IF;
    IF jsonb_typeof(p_encabezado->'stock_origenes') <> 'array'
       OR p_encabezado->'stock_origenes' IS DISTINCT FROM v_stock_origenes THEN
      RAISE EXCEPTION 'La procedencia física enviada no coincide con el origen registrado';
    END IF;
    v_stock_origenes_hash := p_encabezado->>'stock_origenes_hash';
    IF v_stock_origenes_hash IS NULL OR v_stock_origenes_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'La huella de procedencia física es inválida';
    END IF;
  ELSE
    IF jsonb_typeof(COALESCE(p_encabezado->'stock_origenes', '[]'::jsonb)) <> 'array'
       OR COALESCE(p_encabezado->'stock_origenes', '[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Un ajuste fiscal no puede introducir procedencia de stock';
    END IF;
  END IF;
  IF p_factura_id IS NOT NULL THEN
    SELECT estado, tenant_id INTO v_estado, v_tenant_id FROM public.facturas_electronicas
    WHERE id = p_factura_id FOR UPDATE;
    IF v_tenant_id IS DISTINCT FROM v_current_tenant THEN
      RAISE EXCEPTION 'El documento no pertenece al tenant activo';
    END IF;
    IF v_estado IS DISTINCT FROM 'RECHAZADA' THEN
      RAISE EXCEPTION 'Solo puede reintentarse un documento rechazado';
    END IF;
    DELETE FROM public.facturacion_factura_stock_origenes WHERE factura_id = v_id;
    DELETE FROM public.facturas_electronicas_lineas WHERE factura_id = v_id;
    UPDATE public.facturas_electronicas SET
      arreglo_id = NULLIF(p_encabezado->>'arreglo_id','')::uuid,
      operacion_id = NULLIF(p_encabezado->>'operacion_id','')::uuid,
      origen_tipo = p_encabezado->>'origen_tipo',
      documento_tipo = p_encabezado->>'documento_tipo',
      documento_asociado_id = NULLIF(p_encabezado->>'documento_asociado_id','')::uuid,
      estado = 'ENVIANDO', ambiente = p_encabezado->>'ambiente',
      emisor_snapshot = p_encabezado->'emisor_snapshot',
      receptor_snapshot = p_encabezado->'receptor_snapshot',
      concepto = (p_encabezado->>'concepto')::smallint,
      fecha_comprobante = (p_encabezado->>'fecha_comprobante')::date,
      fecha_servicio_desde = NULLIF(p_encabezado->>'fecha_servicio_desde','')::date,
      fecha_servicio_hasta = NULLIF(p_encabezado->>'fecha_servicio_hasta','')::date,
      fecha_vencimiento_pago = NULLIF(p_encabezado->>'fecha_vencimiento_pago','')::date,
      fce_sistema = p_encabezado->>'fce_sistema',
      fce_cbu = p_encabezado->>'fce_cbu',
      fce_estado_manual = p_encabezado->>'fce_estado_manual',
      total = (p_encabezado->>'total')::numeric,
      punto_venta = (p_encabezado->>'punto_venta')::integer,
      tipo_comprobante = (p_encabezado->>'tipo_comprobante')::smallint,
      clase_comprobante = p_encabezado->>'clase_comprobante',
      numero_comprobante = (p_encabezado->>'numero_comprobante')::integer,
      condicion_venta = p_encabezado->>'condicion_venta',
      importe_neto_gravado = (p_encabezado->>'importe_neto_gravado')::numeric,
      importe_no_gravado = (p_encabezado->>'importe_no_gravado')::numeric,
      importe_exento = (p_encabezado->>'importe_exento')::numeric,
      importe_iva = (p_encabezado->>'importe_iva')::numeric,
      importe_tributos = (p_encabezado->>'importe_tributos')::numeric,
      otros_impuestos_nacionales = (p_encabezado->>'otros_impuestos_nacionales')::numeric,
      contenido_hash = p_encabezado->>'contenido_hash',
      stock_origenes_hash = v_stock_origenes_hash,
      intencion_hash = p_encabezado->>'intencion_hash',
      cae = NULL, cae_vencimiento = NULL, autorizada_at = NULL,
      error_codigo = NULL, error_mensaje = NULL
    WHERE id = v_id;
  ELSE
    INSERT INTO public.facturas_electronicas (
      id, tenant_id, arreglo_id, operacion_id, origen_tipo, documento_tipo,
      documento_asociado_id, idempotency_key, estado, ambiente,
      emisor_snapshot, receptor_snapshot, concepto, fecha_comprobante,
      fecha_servicio_desde, fecha_servicio_hasta, fecha_vencimiento_pago,
      moneda, total, punto_venta, tipo_comprobante, clase_comprobante,
      numero_comprobante, condicion_venta, importe_neto_gravado,
      importe_no_gravado, importe_exento, importe_iva, importe_tributos,
      otros_impuestos_nacionales, contenido_hash, stock_origenes_hash, intencion_hash, created_by, fce_sistema, fce_cbu, fce_estado_manual
    ) VALUES (
      v_id, v_current_tenant,
      NULLIF(p_encabezado->>'arreglo_id','')::uuid,
      NULLIF(p_encabezado->>'operacion_id','')::uuid,
      p_encabezado->>'origen_tipo', p_encabezado->>'documento_tipo',
      NULLIF(p_encabezado->>'documento_asociado_id','')::uuid,
      (p_encabezado->>'idempotency_key')::uuid, 'ENVIANDO',
      p_encabezado->>'ambiente', p_encabezado->'emisor_snapshot',
      p_encabezado->'receptor_snapshot', (p_encabezado->>'concepto')::smallint,
      (p_encabezado->>'fecha_comprobante')::date,
      NULLIF(p_encabezado->>'fecha_servicio_desde','')::date,
      NULLIF(p_encabezado->>'fecha_servicio_hasta','')::date,
      NULLIF(p_encabezado->>'fecha_vencimiento_pago','')::date,
      'PES', (p_encabezado->>'total')::numeric,
      (p_encabezado->>'punto_venta')::integer,
      (p_encabezado->>'tipo_comprobante')::smallint,
      p_encabezado->>'clase_comprobante',
      (p_encabezado->>'numero_comprobante')::integer,
      p_encabezado->>'condicion_venta',
      (p_encabezado->>'importe_neto_gravado')::numeric,
      (p_encabezado->>'importe_no_gravado')::numeric,
      (p_encabezado->>'importe_exento')::numeric,
      (p_encabezado->>'importe_iva')::numeric,
      (p_encabezado->>'importe_tributos')::numeric,
      (p_encabezado->>'otros_impuestos_nacionales')::numeric,
      p_encabezado->>'contenido_hash', v_stock_origenes_hash, p_encabezado->>'intencion_hash', NULLIF(p_encabezado->>'created_by','')::uuid,
      p_encabezado->>'fce_sistema', p_encabezado->>'fce_cbu', p_encabezado->>'fce_estado_manual'
    );
  END IF;
  INSERT INTO public.facturacion_factura_stock_origenes (
    tenant_id, factura_id, operacion_linea_id, operacion_origen_id, stock_id, taller_id, producto_id,
    origen_linea, cantidad_original, nombre_snapshot, codigo_snapshot
  )
  SELECT v_current_tenant, v_id, x.operacion_linea_id, x.operacion_origen_id, x.stock_id, x.taller_id, x.producto_id,
    x.origen_linea, x.cantidad_original, x.nombre_snapshot, x.codigo_snapshot
  FROM jsonb_to_recordset(v_stock_origenes) AS x(
    operacion_linea_id uuid, operacion_origen_id uuid, stock_id uuid, taller_id uuid, producto_id uuid,
    origen_linea text, cantidad_original integer, nombre_snapshot text, codigo_snapshot text
  );
  INSERT INTO public.facturas_electronicas_lineas (
    factura_id, ordinal, origen, source_id, descripcion, codigo, cantidad,
    importe_unitario, subtotal, tratamiento_iva, iva_alicuota_id,
    iva_alicuota, importe_neto, importe_iva, importe_total, snapshot
  )
  SELECT v_id, x.ordinal, x.origen, x.source_id, x.descripcion, x.codigo,
    x.cantidad, x.importe_unitario, x.subtotal, x.tratamiento_iva,
    x.iva_alicuota_id, x.iva_alicuota, x.importe_neto, x.importe_iva,
    x.importe_total, COALESCE(x.snapshot, '{}'::jsonb)
  FROM jsonb_to_recordset(p_lineas) AS x(
    ordinal smallint, origen text, source_id uuid, descripcion text, codigo text,
    cantidad numeric, importe_unitario numeric, subtotal numeric,
    tratamiento_iva text, iva_alicuota_id smallint, iva_alicuota numeric,
    importe_neto numeric, importe_iva numeric, importe_total numeric, snapshot jsonb
  );
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_preparar_documento"(jsonb, jsonb, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_preparar_documento"(jsonb, jsonb, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_preparar_documento"(jsonb, jsonb, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_preparar_documento"(jsonb, jsonb, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_preparar_documento"(jsonb, jsonb, uuid) TO "postgres";


CREATE INDEX IF NOT EXISTS facturacion_nc_devoluciones_linea_idx ON public.facturacion_nc_devoluciones (operacion_linea_id);

-- Reserve exact physical source quantities across VENTA and ARREGLO.
CREATE OR REPLACE FUNCTION public.rpc_facturacion_reservar_devoluciones(p_nota_id uuid, p_devoluciones jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_item jsonb;
  v_linea_id uuid;
  v_raw_id text;
  v_raw_cantidad text;
  v_cantidad_bigint bigint;
  v_cantidad integer;
  v_cantidad_original integer;
  v_stock uuid;
  v_taller uuid;
  v_origen_linea text;
  v_operacion_origen uuid;
  v_tipo_operacion text;
  v_used bigint;
  v_duplicate integer;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Sesion sin tenant activo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.cliente_id = auth.uid() AND tm.tenant_id = v_tenant AND tm.rol = 'admin'
  ) THEN RAISE EXCEPTION 'Solo un administrador del tenant puede reservar devoluciones'; END IF;
  IF jsonb_typeof(COALESCE(p_devoluciones, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Devoluciones inválidas';
  END IF;

  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' OR v_nota.estado <> 'ENVIANDO' THEN
    RAISE EXCEPTION 'Nota de crédito inválida para reservar devoluciones';
  END IF;

  SELECT * INTO v_original
  FROM public.facturas_electronicas
  WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_original.documento_tipo <> 'FACTURA' OR v_original.estado <> 'AUTORIZADA'
     OR v_original.origen_tipo NOT IN ('VENTA','ARREGLO')
     OR v_nota.origen_tipo IS DISTINCT FROM v_original.origen_tipo THEN
    RAISE EXCEPTION 'La factura original no es una factura autorizada de venta o arreglo';
  END IF;

  SELECT count(*) INTO v_duplicate
  FROM (
    SELECT value->>'operacionLineaId'
    FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb))
    GROUP BY 1 HAVING count(*) > 1
  ) duplicated;
  IF v_duplicate > 0 THEN RAISE EXCEPTION 'No se puede repetir una línea de stock'; END IF;

  -- Validate all IDs/quantities before acquiring source locks.
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_raw_id := COALESCE(v_item->>'operacionLineaId', '');
    IF v_raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'El identificador de línea de stock es inválido';
    END IF;
    v_raw_cantidad := v_item->>'cantidad';
    IF v_raw_cantidad IS NULL OR v_raw_cantidad !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'La cantidad debe ser un entero no negativo';
    END IF;
    v_cantidad_bigint := v_raw_cantidad::bigint;
    IF v_cantidad_bigint > 2147483647 THEN RAISE EXCEPTION 'La cantidad supera el máximo permitido'; END IF;
  END LOOP;

  -- Lock physical source lines in a deterministic order across concurrent notes/invoices.
  FOR v_linea_id IN
    SELECT DISTINCT (entry.value->>'operacionLineaId')::uuid
    FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) AS entry(value)
    ORDER BY 1
  LOOP
    PERFORM 1
    FROM public.operaciones_lineas ol
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.operacion_linea_id = ol.id AND sfo.factura_id = v_original.id AND sfo.tenant_id = v_tenant
    JOIN public.stocks s ON s.id = sfo.stock_id AND s.tenant_id = v_tenant
    WHERE ol.id = v_linea_id
    FOR UPDATE OF ol, s;
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la procedencia física de la factura original'; END IF;
  END LOOP;

  -- On a rejected retry, replace only the unapplied reservation set atomically.
  DELETE FROM public.facturacion_nc_devoluciones
  WHERE nota_credito_id = p_nota_id AND operacion_ajuste_id IS NULL;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_devoluciones, '[]'::jsonb)) LOOP
    v_linea_id := (v_item->>'operacionLineaId')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    SELECT sfo.cantidad_original, sfo.stock_id, sfo.taller_id, sfo.origen_linea, sfo.operacion_origen_id, o.tipo::text
      INTO v_cantidad_original, v_stock, v_taller, v_origen_linea, v_operacion_origen, v_tipo_operacion
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    JOIN public.operaciones o
      ON o.id = sfo.operacion_origen_id AND o.tenant_id = v_tenant
    JOIN public.stocks s
      ON s.id = sfo.stock_id AND s.tenant_id = v_tenant AND s.taller_id = sfo.taller_id
      AND s.taller_id = o.taller_id AND s.producto_id = sfo.producto_id
    WHERE sfo.factura_id = v_original.id AND sfo.tenant_id = v_tenant AND sfo.operacion_linea_id = v_linea_id
      AND ((v_original.origen_tipo = 'VENTA' AND sfo.origen_linea = 'VENTA'
            AND sfo.operacion_origen_id = v_original.operacion_id AND o.tipo = 'VENTA')
        OR (v_original.origen_tipo = 'ARREGLO' AND sfo.origen_linea = 'REPUESTO'
            AND o.tipo = 'ASIGNACION_ARREGLO'
            AND EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo oa
              WHERE oa.operacion_id = sfo.operacion_origen_id AND oa.arreglo_id = v_original.arreglo_id)));
    IF NOT FOUND THEN RAISE EXCEPTION 'La línea no pertenece a la venta o asignación original'; END IF;

    -- Zero explicitly means fiscal-only for this line, but membership is still validated.
    IF v_cantidad = 0 THEN CONTINUE; END IF;
    IF v_original.stock_origenes_hash IS NULL THEN
      RAISE EXCEPTION 'La factura histórica no tiene procedencia física verificable para devolver stock';
    END IF;
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id
      AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA')
      AND n.id <> p_nota_id;
    IF v_cantidad > v_cantidad_original - v_used THEN
      RAISE EXCEPTION 'La cantidad a devolver supera el saldo físico disponible';
    END IF;
    INSERT INTO public.facturacion_nc_devoluciones(
      tenant_id, nota_credito_id, factura_original_id, operacion_linea_id, stock_id, cantidad
    ) VALUES (v_tenant, p_nota_id, v_original.id, v_linea_id, v_stock, v_cantidad);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_reservar_devoluciones(uuid,jsonb) TO authenticated, service_role;


-- Apply stock only after verified ARCA authorization, exactly once.
CREATE OR REPLACE FUNCTION public.rpc_facturacion_finalizar_nc(p_tenant_id uuid, p_nota_id uuid, p_cae text, p_cae_vencimiento date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_tenant uuid := p_tenant_id;
  v_nota public.facturas_electronicas%ROWTYPE;
  v_original public.facturas_electronicas%ROWTYPE;
  v_linea_id uuid;
  v_source record;
  v_taller_id uuid;
  v_operacion uuid;
  v_item record;
  v_rows integer;
  v_used bigint;
BEGIN
  IF v_tenant IS NULL OR auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Finalización reservada al servicio de facturación';
  END IF;
  SELECT * INTO v_nota
  FROM public.facturas_electronicas
  WHERE id = p_nota_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_nota.documento_tipo <> 'NOTA_CREDITO' THEN RAISE EXCEPTION 'Nota de crédito no encontrada'; END IF;
  IF v_nota.estado = 'AUTORIZADA' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones
      WHERE nota_credito_id = p_nota_id AND cantidad > 0 AND operacion_ajuste_id IS NULL
    ) THEN RAISE EXCEPTION 'La nota autorizada tiene devoluciones pendientes de aplicar'; END IF;
    RETURN p_nota_id;
  END IF;
  IF v_nota.estado NOT IN ('ENVIANDO','INCIERTA') OR p_cae IS NULL OR p_cae !~ '^[0-9]{14}$' OR p_cae_vencimiento IS NULL THEN
    RAISE EXCEPTION 'Datos de autorización inválidos';
  END IF;
  SELECT * INTO v_original
  FROM public.facturas_electronicas
  WHERE id = v_nota.documento_asociado_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_original.documento_tipo <> 'FACTURA' OR v_original.estado <> 'AUTORIZADA'
     OR v_original.origen_tipo NOT IN ('VENTA','ARREGLO')
     OR v_nota.origen_tipo IS DISTINCT FROM v_original.origen_tipo THEN
    RAISE EXCEPTION 'Factura original no autorizada o con origen inconsistente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturacion_nc_devoluciones WHERE nota_credito_id=p_nota_id AND operacion_ajuste_id IS NOT NULL) THEN
    RAISE EXCEPTION 'La nota tiene un ajuste de stock previo y requiere reconciliación';
  END IF;

  -- Serialize application by the physical source line, independent of invoice/environment.
  FOR v_linea_id IN
    SELECT DISTINCT d.operacion_linea_id
    FROM public.facturacion_nc_devoluciones d
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY d.operacion_linea_id
  LOOP
    SELECT sfo.operacion_origen_id, sfo.stock_id, sfo.taller_id, sfo.producto_id,
      sfo.origen_linea, sfo.cantidad_original, o.tipo::text AS tipo_operacion
    INTO v_source
    FROM public.facturacion_factura_stock_origenes sfo
    JOIN public.operaciones_lineas ol
      ON ol.id = sfo.operacion_linea_id AND ol.operacion_id = sfo.operacion_origen_id AND ol.stock_id = sfo.stock_id
    JOIN public.operaciones o
      ON o.id = sfo.operacion_origen_id AND o.tenant_id = v_tenant
    JOIN public.stocks s
      ON s.id = sfo.stock_id AND s.tenant_id = v_tenant AND s.taller_id = sfo.taller_id
      AND s.taller_id = o.taller_id AND s.producto_id = sfo.producto_id
    WHERE sfo.tenant_id = v_tenant AND sfo.factura_id = v_original.id AND sfo.operacion_linea_id = v_linea_id
      AND ((v_original.origen_tipo = 'VENTA' AND sfo.origen_linea = 'VENTA'
            AND sfo.operacion_origen_id = v_original.operacion_id AND o.tipo = 'VENTA')
        OR (v_original.origen_tipo = 'ARREGLO' AND sfo.origen_linea = 'REPUESTO'
            AND o.tipo = 'ASIGNACION_ARREGLO'
            AND EXISTS (SELECT 1 FROM public.operaciones_asignacion_arreglo oa
              WHERE oa.operacion_id = sfo.operacion_origen_id AND oa.arreglo_id = v_original.arreglo_id)))
    FOR UPDATE OF ol, s;
    IF NOT FOUND OR v_original.stock_origenes_hash IS NULL THEN
      RAISE EXCEPTION 'La devolución perdió una procedencia física verificable';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.facturacion_nc_devoluciones d
      WHERE d.nota_credito_id = p_nota_id AND d.operacion_linea_id = v_linea_id AND d.stock_id = v_source.stock_id
    ) THEN RAISE EXCEPTION 'El stock reservado no coincide con la procedencia original'; END IF;
    SELECT COALESCE(sum(d.cantidad), 0)::bigint INTO v_used
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturas_electronicas n ON n.id = d.nota_credito_id AND n.tenant_id = v_tenant
    WHERE d.operacion_linea_id = v_linea_id AND n.estado IN ('ENVIANDO','INCIERTA','AUTORIZADA');
    IF v_used > v_source.cantidad_original THEN RAISE EXCEPTION 'El saldo físico reservado excede la cantidad original'; END IF;
  END LOOP;

  FOR v_taller_id IN
    SELECT DISTINCT sfo.taller_id
    FROM public.facturacion_nc_devoluciones d
    JOIN public.facturacion_factura_stock_origenes sfo
      ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
      AND sfo.stock_id = d.stock_id AND sfo.tenant_id = v_tenant
    WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
    ORDER BY sfo.taller_id
  LOOP
    INSERT INTO public.operaciones(tenant_id, tipo, taller_id, fecha)
    VALUES (v_tenant, 'AJUSTE', v_taller_id, now())
    RETURNING id INTO v_operacion;

    FOR v_item IN
      SELECT d.stock_id, sum(d.cantidad)::integer AS cantidad
      FROM public.facturacion_nc_devoluciones d
      JOIN public.facturacion_factura_stock_origenes sfo
        ON sfo.factura_id = d.factura_original_id AND sfo.operacion_linea_id = d.operacion_linea_id
        AND sfo.stock_id = d.stock_id AND sfo.taller_id = v_taller_id AND sfo.tenant_id = v_tenant
      WHERE d.nota_credito_id = p_nota_id AND d.cantidad > 0
      GROUP BY d.stock_id ORDER BY d.stock_id
    LOOP
      UPDATE public.stocks
      SET cantidad = cantidad + v_item.cantidad, updated_at = now()
      WHERE id = v_item.stock_id AND tenant_id = v_tenant AND taller_id = v_taller_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows <> 1 THEN RAISE EXCEPTION 'No se pudo reingresar el stock físico de origen'; END IF;

      INSERT INTO public.operaciones_lineas(operacion_id, stock_id, cantidad, monto_unitario, delta_cantidad)
      VALUES (v_operacion, v_item.stock_id, v_item.cantidad, 0, v_item.cantidad);

      UPDATE public.facturacion_nc_devoluciones
      SET operacion_ajuste_id = v_operacion
      WHERE nota_credito_id = p_nota_id AND stock_id = v_item.stock_id AND operacion_ajuste_id IS NULL;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows < 1 THEN RAISE EXCEPTION 'No se pudo registrar la trazabilidad del ajuste de stock'; END IF;
    END LOOP;
  END LOOP;

  UPDATE public.facturas_electronicas
  SET estado = 'AUTORIZADA', cae = p_cae, cae_vencimiento = p_cae_vencimiento,
      autorizada_at = now(), error_codigo = NULL, error_mensaje = NULL
  WHERE id = p_nota_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'No se pudo confirmar la autorización de la nota'; END IF;
  RETURN p_nota_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_finalizar_nc(uuid,uuid,text,date) TO service_role;
