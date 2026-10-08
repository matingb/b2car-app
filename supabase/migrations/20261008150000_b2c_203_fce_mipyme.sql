ALTER TABLE public.facturacion_configuracion_ambiente
  ADD COLUMN fce_cbu text,
  ADD CONSTRAINT facturacion_configuracion_ambiente_fce_cbu_check CHECK (fce_cbu IS NULL OR fce_cbu ~ '^[0-9]{22}$');

ALTER TABLE public.facturas_electronicas
  ADD COLUMN fce_sistema text,
  ADD COLUMN fce_cbu text,
  ADD COLUMN fce_estado_manual text,
  ADD COLUMN fce_estado_manual_actualizado_at timestamptz,
  ADD COLUMN fce_estado_manual_actualizado_by uuid;
ALTER TABLE public.facturas_electronicas DROP CONSTRAINT facturas_electronicas_tipo_comprobante_check;
ALTER TABLE public.facturas_electronicas ADD CONSTRAINT facturas_electronicas_tipo_comprobante_check CHECK (tipo_comprobante = ANY (ARRAY[1,2,3,6,7,8,11,12,13,51,52,53,201,206,211]));
ALTER TABLE public.facturas_electronicas ADD CONSTRAINT facturas_electronicas_fce_estado_check CHECK (fce_estado_manual IS NULL OR fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA'));
ALTER TABLE public.facturas_electronicas ADD CONSTRAINT facturas_electronicas_fce_data_check CHECK (
  (tipo_comprobante IN (201,206,211) AND fce_sistema IN ('SCA','ADC') AND fce_cbu ~ '^[0-9]{22}$' AND (fce_estado_manual IS NULL OR fce_estado_manual IN ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA','PAGADA','ANULADA')))
  OR (tipo_comprobante NOT IN (201,206,211) AND fce_sistema IS NULL AND fce_cbu IS NULL AND fce_estado_manual IS NULL)
);


CREATE OR REPLACE FUNCTION public.rpc_facturacion_adquirir_lease (
  p_emisor_cuit      text,
  p_punto_venta      integer,
  p_tipo_comprobante smallint,
  p_lease_token      uuid,
  p_segundos         integer  DEFAULT 90
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_current_tenant uuid := public.current_tenant_id();
BEGIN
  IF p_emisor_cuit !~ '^[0-9]{11}$' OR p_punto_venta IS NULL OR p_punto_venta <= 0
     OR p_tipo_comprobante NOT IN (1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53, 201, 206, 211)
     OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Parametros de lease fiscal invalidos';
  END IF;
  -- Si es invocado por usuario autenticado, validar que el CUIT y punto de venta pertenezcan a su tenant
  IF v_current_tenant IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.facturacion_configuracion_ambiente
      WHERE tenant_id = v_current_tenant
        AND cuit = p_emisor_cuit
        AND punto_venta = p_punto_venta
    ) THEN
      RAISE EXCEPTION 'El CUIT y punto de venta no pertenecen a su tenant';
    END IF;
  END IF;
  INSERT INTO public.facturacion_emision_leases (
    emisor_cuit, punto_venta, tipo_comprobante, lease_token, expires_at, updated_at
  ) VALUES (
    p_emisor_cuit, p_punto_venta, p_tipo_comprobante, p_lease_token,
    now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_segundos, 90), 15), 300)), now()
  )
  ON CONFLICT (emisor_cuit, punto_venta, tipo_comprobante) DO UPDATE
    SET lease_token = EXCLUDED.lease_token, expires_at = EXCLUDED.expires_at, updated_at = now()
    WHERE public.facturacion_emision_leases.expires_at < now()
       OR public.facturacion_emision_leases.lease_token = EXCLUDED.lease_token;
  RETURN FOUND;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "postgres";

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
  IF p_factura_id IS NOT NULL THEN
    SELECT estado, tenant_id INTO v_estado, v_tenant_id FROM public.facturas_electronicas
    WHERE id = p_factura_id FOR UPDATE;
    IF v_tenant_id IS DISTINCT FROM v_current_tenant THEN
      RAISE EXCEPTION 'El documento no pertenece al tenant activo';
    END IF;
    IF v_estado IS DISTINCT FROM 'RECHAZADA' THEN
      RAISE EXCEPTION 'Solo puede reintentarse un documento rechazado';
    END IF;
    DELETE FROM public.facturas_electronicas_lineas WHERE factura_id = v_id;
    UPDATE public.facturas_electronicas SET
      arreglo_id = NULLIF(p_encabezado->>'arreglo_id','')::uuid,
      operacion_id = NULLIF(p_encabezado->>'operacion_id','')::uuid,
      origen_tipo = p_encabezado->>'origen_tipo',
      documento_tipo = p_encabezado->>'documento_tipo',
      documento_asociado_id = NULLIF(p_encabezado->>'documento_asociado_id','')::uuid,
      idempotency_key = (p_encabezado->>'idempotency_key')::uuid,
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
      otros_impuestos_nacionales, contenido_hash, created_by, fce_sistema, fce_cbu, fce_estado_manual
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
      p_encabezado->>'contenido_hash', NULLIF(p_encabezado->>'created_by','')::uuid,
      p_encabezado->>'fce_sistema', p_encabezado->>'fce_cbu', p_encabezado->>'fce_estado_manual'
    );
  END IF;
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

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_snapshot_autorizado()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_factura_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'facturas_electronicas' THEN
    IF OLD.estado = 'AUTORIZADA' THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
      IF ROW(OLD.fce_estado_manual, OLD.fce_estado_manual_actualizado_at, OLD.fce_estado_manual_actualizado_by) IS DISTINCT FROM ROW(NEW.fce_estado_manual, NEW.fce_estado_manual_actualizado_at, NEW.fce_estado_manual_actualizado_by) THEN
        IF auth.jwt() ->> 'user_role' IS DISTINCT FROM 'admin' OR OLD.estado <> 'AUTORIZADA' OR OLD.tipo_comprobante NOT IN (201,206,211) OR ROW(OLD.tenant_id, OLD.arreglo_id, OLD.operacion_id, OLD.origen_tipo, OLD.documento_tipo, OLD.documento_asociado_id, OLD.idempotency_key, OLD.estado, OLD.ambiente, OLD.emisor_snapshot, OLD.receptor_snapshot, OLD.concepto, OLD.fecha_comprobante, OLD.fecha_servicio_desde, OLD.fecha_servicio_hasta, OLD.fecha_vencimiento_pago, OLD.moneda, OLD.total, OLD.punto_venta, OLD.tipo_comprobante, OLD.numero_comprobante, OLD.cae, OLD.cae_vencimiento, OLD.clase_comprobante, OLD.condicion_venta, OLD.importe_neto_gravado, OLD.importe_no_gravado, OLD.importe_exento, OLD.importe_iva, OLD.importe_tributos, OLD.otros_impuestos_nacionales, OLD.fce_sistema, OLD.fce_cbu) IS DISTINCT FROM ROW(NEW.tenant_id, NEW.arreglo_id, NEW.operacion_id, NEW.origen_tipo, NEW.documento_tipo, NEW.documento_asociado_id, NEW.idempotency_key, NEW.estado, NEW.ambiente, NEW.emisor_snapshot, NEW.receptor_snapshot, NEW.concepto, NEW.fecha_comprobante, NEW.fecha_servicio_desde, NEW.fecha_servicio_hasta, NEW.fecha_vencimiento_pago, NEW.moneda, NEW.total, NEW.punto_venta, NEW.tipo_comprobante, NEW.numero_comprobante, NEW.cae, NEW.cae_vencimiento, NEW.clase_comprobante, NEW.condicion_venta, NEW.importe_neto_gravado, NEW.importe_no_gravado, NEW.importe_exento, NEW.importe_iva, NEW.importe_tributos, NEW.otros_impuestos_nacionales, NEW.fce_sistema, NEW.fce_cbu) THEN RAISE EXCEPTION 'No tiene permiso para actualizar el estado manual FCE'; END IF;
      END IF;
      IF ROW(OLD.tenant_id, OLD.arreglo_id, OLD.operacion_id, OLD.origen_tipo,
          OLD.documento_tipo, OLD.documento_asociado_id, OLD.idempotency_key,
          OLD.estado, OLD.ambiente, OLD.emisor_snapshot, OLD.receptor_snapshot,
          OLD.concepto, OLD.fecha_comprobante, OLD.fecha_servicio_desde,
          OLD.fecha_servicio_hasta, OLD.fecha_vencimiento_pago, OLD.moneda,
          OLD.total, OLD.punto_venta, OLD.tipo_comprobante, OLD.numero_comprobante,
          OLD.cae, OLD.cae_vencimiento, OLD.clase_comprobante, OLD.condicion_venta,
          OLD.importe_neto_gravado, OLD.importe_no_gravado, OLD.importe_exento,
          OLD.importe_iva, OLD.importe_tributos, OLD.otros_impuestos_nacionales, OLD.fce_sistema, OLD.fce_cbu)
        IS DISTINCT FROM
        ROW(NEW.tenant_id, NEW.arreglo_id, NEW.operacion_id, NEW.origen_tipo,
          NEW.documento_tipo, NEW.documento_asociado_id, NEW.idempotency_key,
          NEW.estado, NEW.ambiente, NEW.emisor_snapshot, NEW.receptor_snapshot,
          NEW.concepto, NEW.fecha_comprobante, NEW.fecha_servicio_desde,
          NEW.fecha_servicio_hasta, NEW.fecha_vencimiento_pago, NEW.moneda,
          NEW.total, NEW.punto_venta, NEW.tipo_comprobante, NEW.numero_comprobante,
          NEW.cae, NEW.cae_vencimiento, NEW.clase_comprobante, NEW.condicion_venta,
          NEW.importe_neto_gravado, NEW.importe_no_gravado, NEW.importe_exento,
          NEW.importe_iva, NEW.importe_tributos, NEW.otros_impuestos_nacionales, NEW.fce_sistema, NEW.fce_cbu) THEN
        RAISE EXCEPTION 'El documento fiscal autorizado es inmutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);
  IF EXISTS (SELECT 1 FROM public.facturas_electronicas f
             WHERE f.id = v_factura_id AND f.estado = 'AUTORIZADA') THEN
    RAISE EXCEPTION 'Las líneas de un documento fiscal autorizado son inmutables';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_snapshot_autorizado"() TO "postgres";

