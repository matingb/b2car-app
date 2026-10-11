-- B2C-197: metadata-only logical backfill. No UPDATE of historical money/timestamps.
ALTER TABLE public.arreglos
  ADD COLUMN precios_incluyen_iva boolean NOT NULL DEFAULT true,
  ADD COLUMN tasa_iva numeric,
  ADD CONSTRAINT arreglos_tasa_iva_check CHECK (tasa_iva >= 0 AND tasa_iva < 'Infinity'::numeric),
  ADD CONSTRAINT arreglos_iva_snapshot_check CHECK (precios_incluyen_iva OR tasa_iva IS NOT NULL);

-- Commercial rate, not fiscal condition/alicuota. Round the extended line once.
CREATE OR REPLACE FUNCTION public.importe_comercial_arreglo(
  p_importe numeric, p_incluye boolean, p_tasa numeric
) RETURNS numeric LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public' AS $function$
  SELECT CASE WHEN p_incluye THEN p_importe
    ELSE round(p_importe, 2) + round(round(p_importe, 2) * p_tasa, 2) END;
$function$;

-- Invoker rights: callers retain RLS; internal definer callers check tenant.
CREATE OR REPLACE FUNCTION public._b2c197_total_entradas(
  p_arreglo_id uuid, p_incluye boolean, p_tasa numeric, p_pendientes jsonb,
  p_formulario boolean DEFAULT true
) RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT coalesce(sum(public.importe_comercial_arreglo(x.importe, p_incluye, p_tasa)), 0)
  FROM (
    SELECT d.cantidad * coalesce(d.horas_facturadas, 1) * d.precio_hora_facturada AS importe
    FROM public.detalle_arreglo d WHERE d.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT l.cantidad * l.monto_unitario
    FROM public.operaciones_asignacion_arreglo oa
    JOIN public.operaciones_lineas l ON l.operacion_id = oa.operacion_id
    WHERE oa.arreglo_id = p_arreglo_id
    UNION ALL
    SELECT (j->>'cantidad')::numeric * (j->>'monto_unitario')::numeric
    FROM jsonb_array_elements(coalesce(p_pendientes, '[]'::jsonb)) j
    UNION ALL
    SELECT c.costo FROM (
      SELECT costo FROM public.detalle_form_custom
      WHERE arreglo_id = p_arreglo_id AND p_formulario
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
  ) x;
$function$;
REVOKE ALL ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._b2c197_total_entradas(uuid, boolean, numeric, jsonb, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._b2c197_guardar_iva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cambio boolean;
  v_recalcular boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cambio := NOT NEW.precios_incluyen_iva OR NEW.tasa_iva IS NOT NULL;
  ELSE
    v_cambio := NEW.precios_incluyen_iva IS DISTINCT FROM OLD.precios_incluyen_iva
      OR NEW.tasa_iva IS DISTINCT FROM OLD.tasa_iva;
  END IF;
  IF v_cambio THEN
    IF coalesce(auth.role(), '') <> 'service_role' AND
       (NEW.tenant_id IS DISTINCT FROM public.current_tenant_id()
        OR NOT public._b2c179_tiene_permiso('arreglos:precios:edit')) THEN
      RAISE EXCEPTION 'Sin permiso para editar precios del arreglo' USING ERRCODE = '42501';
    END IF;
    IF NEW.tasa_iva IS NULL OR NEW.tasa_iva < 0 OR NEW.tasa_iva >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Se requiere tasa_iva comercial valida del servidor' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.total_cobrado > 0 OR NEW.total_cobrado > 0 THEN
        RAISE EXCEPTION 'No se puede cambiar IVA con cobros vigentes' USING ERRCODE = '55000';
      END IF;
      IF NEW.precios_incluyen_iva IS NOT DISTINCT FROM OLD.precios_incluyen_iva THEN
        RAISE EXCEPTION 'La tasa comercial solo cambia junto con el modo IVA' USING ERRCODE = '22023';
      END IF;
      IF EXISTS (SELECT 1 FROM public.facturas_electronicas f
        WHERE f.arreglo_id = OLD.id AND f.estado IN ('AUTORIZADA','ENVIANDO','INCIERTA')) THEN
        RAISE EXCEPTION 'El arreglo tiene una factura autorizada o en envio/reconciliacion' USING ERRCODE = '55001';
      END IF;
    END IF;
  END IF;
  v_recalcular := v_cambio;
  IF TG_OP = 'UPDATE' THEN
    v_recalcular := v_recalcular OR (NEW.tasa_iva IS NOT NULL AND (
      NEW.precio_final IS DISTINCT FROM OLD.precio_final
      OR NEW.precio_sin_iva IS DISTINCT FROM OLD.precio_sin_iva
      OR NEW.repuestos_pendientes IS DISTINCT FROM OLD.repuestos_pendientes));
  END IF;
  IF v_recalcular THEN
    NEW.precio_final := public._b2c197_total_entradas(NEW.id,
      NEW.precios_incluyen_iva, NEW.tasa_iva, NEW.repuestos_pendientes, true);
    NEW.precio_sin_iva := CASE WHEN NEW.precios_incluyen_iva
      THEN round(NEW.precio_final / (1 + NEW.tasa_iva), 2)
      ELSE public._b2c197_total_entradas(NEW.id, false, 0, NEW.repuestos_pendientes, true) END;
    NEW.esta_pago := NEW.precio_final > 0 AND NEW.total_cobrado >= NEW.precio_final;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._b2c197_guardar_iva() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.calcular_precio_final_arreglo (
  p_arreglo_id uuid
)
  RETURNS numeric
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_arreglo public.arreglos;
BEGIN
  SELECT * INTO v_arreglo FROM public.arreglos WHERE id = p_arreglo_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF coalesce(auth.role(), '') <> 'service_role'
     AND v_arreglo.tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'Arreglo fuera del tenant activo' USING ERRCODE = '42501';
  END IF;
  -- NULL snapshot treats entered prices as included; recalculation occurs only after an intentional edit, never as a migration backfill.
  RETURN public._b2c197_total_entradas(p_arreglo_id,
    v_arreglo.precios_incluyen_iva, v_arreglo.tasa_iva,
    v_arreglo.repuestos_pendientes, true);
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."calcular_precio_final_arreglo"(uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.recalcular_precio_final_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME IN ('detalle_arreglo', 'detalle_form_custom') THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_asignacion_arreglo' THEN
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  ELSIF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
    IF v_arreglo_id IS NULL THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;
  IF v_arreglo_id IS NOT NULL THEN
    -- Lock before reading inputs, not after computing a stale total.
    PERFORM 1 FROM public.arreglos WHERE id = v_arreglo_id FOR UPDATE;
    UPDATE public.arreglos
    SET precio_final = public.calcular_precio_final_arreglo(v_arreglo_id)
    WHERE id = v_arreglo_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."recalcular_precio_final_arreglo"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."recalcular_precio_final_arreglo"() TO "postgres";

CREATE OR REPLACE FUNCTION public.facturacion_bloquear_mutacion_arreglo()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_rec jsonb;
  v_arreglo_id uuid;
  v_protegido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME = 'arreglos' THEN
    v_arreglo_id := (v_rec ->> 'id')::uuid;
    SELECT EXISTS (SELECT 1 FROM public.facturas_electronicas f
      WHERE f.arreglo_id = v_arreglo_id AND f.estado IN ('AUTORIZADA', 'ENVIANDO', 'INCIERTA'))
      INTO v_protegido;
    IF NOT v_protegido THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
       OR OLD.precios_incluyen_iva IS DISTINCT FROM NEW.precios_incluyen_iva
       OR OLD.tasa_iva IS DISTINCT FROM NEW.tasa_iva
       OR OLD.precio_final IS DISTINCT FROM NEW.precio_final
       OR OLD.precio_sin_iva IS DISTINCT FROM NEW.precio_sin_iva
       OR OLD.estado IS DISTINCT FROM NEW.estado THEN
      RAISE EXCEPTION 'El arreglo ya posee una factura electronica autorizada y sus datos fiscales no se pueden modificar'
        USING ERRCODE = '55001';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'vehiculos' THEN
    IF TG_OP = 'UPDATE' AND OLD.cliente_id IS NOT DISTINCT FROM NEW.cliente_id THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.arreglos a
      WHERE a.vehiculo_id = (v_rec ->> 'id')::uuid
        AND public.facturacion_arreglo_autorizado(a.id)
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente de un vehiculo con arreglos facturados'
        USING ERRCODE = '55001';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME = 'operaciones_lineas' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'operacion_id')::uuid
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'operaciones' THEN
    SELECT oa.arreglo_id INTO v_arreglo_id
    FROM public.operaciones_asignacion_arreglo oa
    WHERE oa.operacion_id = (v_rec ->> 'id')::uuid
    LIMIT 1;
  ELSE
    v_arreglo_id := (v_rec ->> 'arreglo_id')::uuid;
  END IF;
  -- Same source row lock as mode changes, collection and fiscal preparation.
  IF v_arreglo_id IS NOT NULL THEN
    PERFORM 1 FROM public.arreglos WHERE id = v_arreglo_id FOR UPDATE;
  END IF;
  IF v_arreglo_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.facturas_electronicas f
    WHERE f.arreglo_id = v_arreglo_id AND f.estado IN ('AUTORIZADA', 'ENVIANDO', 'INCIERTA')
  ) THEN
    RAISE EXCEPTION 'No se pueden modificar lineas de un arreglo con factura electronica autorizada'
      USING ERRCODE = '55001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_arreglo"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_arreglo"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."facturacion_bloquear_mutacion_arreglo"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."facturacion_bloquear_mutacion_arreglo"() TO "postgres";

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
  v_arreglo public.arreglos;
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
    -- Always lock source before document, matching collections and mode updates.
    SELECT * INTO v_arreglo FROM public.arreglos
    WHERE id = (p_encabezado->>'arreglo_id')::uuid AND tenant_id = v_current_tenant
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El arreglo no pertenece al tenant activo';
    END IF;
    -- New pricing snapshots must be echoed by the server after canonical loading.
    -- Reject a candidate prepared before a concurrent toggle (including equal totals).
    IF p_encabezado->>'documento_tipo' = 'FACTURA' AND
       (v_arreglo.tasa_iva IS NOT NULL OR p_encabezado ? 'precios_incluyen_iva') THEN
      IF (p_encabezado->>'precios_incluyen_iva')::boolean IS DISTINCT FROM v_arreglo.precios_incluyen_iva
         OR (p_encabezado->>'tasa_iva')::numeric IS DISTINCT FROM v_arreglo.tasa_iva
         OR (p_encabezado->>'total')::numeric IS DISTINCT FROM v_arreglo.precio_final THEN
        RAISE EXCEPTION 'El precio/modo IVA del arreglo cambio; volver a preparar factura'
          USING ERRCODE = '40001';
      END IF;
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
      otros_impuestos_nacionales, contenido_hash, intencion_hash, created_by, fce_sistema, fce_cbu, fce_estado_manual
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
      p_encabezado->>'contenido_hash', p_encabezado->>'intencion_hash', NULLIF(p_encabezado->>'created_by','')::uuid,
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

CREATE OR REPLACE FUNCTION public.rpc_get_arreglo_detalle (
  p_arreglo_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_arreglo jsonb;
  v_detalles jsonb;
  v_asignaciones jsonb;
  v_cobros jsonb;
  v_puede_ver_costos boolean := public._b2c179_tiene_permiso('empleados:view');
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF p_arreglo_id IS NULL THEN RAISE EXCEPTION 'arreglo_id requerido'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'numero_orden', a.numero_orden, 'vehiculo', to_jsonb(v), 'taller_id', a.taller_id, 'taller', to_jsonb(t),
    'categoria', coalesce((SELECT string_agg(ca.nombre, ', ') FROM unnest(a.categorias) c_id JOIN public.categorias_arreglo ca ON ca.id = c_id), ''),
    'categorias', a.categorias, 'empleados', a.empleados,
    'empleados_detallados', public.arreglos_empleados_detallados(a),
    'estado', a.estado, 'descripcion', a.descripcion, 'kilometraje_leido', a.kilometraje_leido,
    'combustible_leido', a.combustible_leido, 'fecha', a.fecha, 'observaciones', a.observaciones,
    'precio_final', a.precio_final, 'precio_sin_iva', a.precio_sin_iva, 'esta_pago', a.esta_pago,
    'precios_incluyen_iva', a.precios_incluyen_iva, 'tasa_iva', a.tasa_iva,
    'total_cobrado', a.total_cobrado,
    'saldo_pendiente', greatest(0, coalesce(a.precio_final, 0) - coalesce(a.total_cobrado, 0)),
    'extra_data', a.extra_data, 'cliente_id', a.cliente_id, 'es_facturable', a.es_facturable,
    'repuestos_pendientes', public._b2c152_publicar_pendientes(a.repuestos_pendientes)
  ) INTO v_arreglo
  FROM public.arreglos a
  JOIN public.vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant_id;
  IF v_arreglo IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'arreglo_id', d.arreglo_id, 'descripcion', d.descripcion,
    'cantidad', d.cantidad, 'precio_hora_facturada', d.precio_hora_facturada,
    'horas_facturadas', d.horas_facturadas, 'horas_trabajadas', d.horas_trabajadas,
    'valor_hora_empleado', CASE WHEN v_puede_ver_costos THEN d.valor_hora_empleado ELSE NULL END,
    'categoria_arreglo_id', d.categoria_arreglo_id, 'empleado_id', d.empleado_id,
    'created_at', d.created_at, 'updated_at', d.updated_at
  ) ORDER BY d.created_at), '[]'::jsonb) INTO v_detalles
  FROM public.detalle_arreglo d
  WHERE d.arreglo_id = p_arreglo_id AND d.tenant_id = v_tenant_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'tipo', o.tipo, 'taller_id', o.taller_id, 'created_at', o.created_at,
    'lineas', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', l.id, 'operacion_id', l.operacion_id, 'stock_id', l.stock_id, 'cantidad', l.cantidad,
      'monto_unitario', l.monto_unitario, 'delta_cantidad', l.delta_cantidad, 'created_at', l.created_at,
      'categoria_arreglo_id', l.categoria_arreglo_id, 'empleado_id', l.empleado_id,
      'producto', jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre,
        'precio_unitario', p.precio_unitario, 'costo_unitario', p.costo_unitario,
        'proveedor', p.proveedor, 'categorias', coalesce(p.categorias, ARRAY[]::text[]))
    ) ORDER BY l.created_at) FROM public.operaciones_lineas l
      JOIN public.stocks s ON s.id = l.stock_id JOIN public.productos p ON p.id = s.producto_id
      WHERE l.operacion_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at), '[]'::jsonb) INTO v_asignaciones
  FROM public.operaciones_asignacion_arreglo oa
  JOIN public.operaciones o ON o.id = oa.operacion_id
  WHERE oa.arreglo_id = p_arreglo_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', omc.operacion_id, 'operacion_id', omc.operacion_id, 'importe', omc.importe,
    'cuenta_id', omc.cuenta_id, 'cuenta_nombre', cf.nombre, 'descripcion', omc.descripcion,
    'fecha', o.fecha, 'created_at', omc.created_at
  ) ORDER BY o.fecha ASC, omc.created_at ASC), '[]'::jsonb) INTO v_cobros
  FROM public.operaciones_cobro_arreglo oca
  JOIN public.operaciones o ON o.id = oca.operacion_id
  JOIN public.operaciones_movimiento_cuenta omc ON omc.operacion_id = oca.operacion_id
  JOIN public.cuentas_financieras cf ON cf.id = omc.cuenta_id
  WHERE oca.arreglo_id = p_arreglo_id AND oca.tenant_id = v_tenant_id;
  RETURN jsonb_build_object(
    'arreglo', v_arreglo,
    'detalles', v_detalles,
    'asignaciones', v_asignaciones,
    'cobros', v_cobros
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_get_arreglo_detalle"(uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_get_arreglo_detalle"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_get_arreglo_detalle"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_get_arreglo_detalle"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_get_arreglo_detalle"(uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_categoria (
  top         integer                  DEFAULT 6,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH lineas AS (
    SELECT d.categoria_arreglo_id AS cat_id, public.importe_comercial_arreglo((CASE WHEN d.horas_facturadas IS NULL
      THEN d.cantidad * d.precio_hora_facturada
      ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END), a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT ol.categoria_arreglo_id AS cat_id, public.importe_comercial_arreglo(ol.cantidad * ol.monto_unitario, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to   IS NULL OR a.fecha <  p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT NULL::uuid AS cat_id,
      public.importe_comercial_arreglo(c.costo, a.precios_incluyen_iva, a.tasa_iva) AS monto
    FROM public.arreglos a
    CROSS JOIN LATERAL (
      SELECT costo FROM public.detalle_form_custom WHERE arreglo_id = a.id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
    WHERE a.tasa_iva IS NOT NULL
      AND (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(c.nombre, 'Sin categoría')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.categorias_arreglo c ON c.id = l.cat_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_facturacion_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_facturacion_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_categoria"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.dashboard_facturacion_por_empleado (
  top         integer                  DEFAULT 6,
  p_from      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_to        timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label    text,
    cantidad integer,
    monto    numeric
  )
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  WITH lineas AS (
    SELECT d.empleado_id AS empleado_id, public.importe_comercial_arreglo((CASE WHEN d.horas_facturadas IS NULL
      THEN d.cantidad * d.precio_hora_facturada
      ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END), a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.detalle_arreglo d
    JOIN public.arreglos a ON a.id = d.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT ol.empleado_id AS empleado_id, public.importe_comercial_arreglo(ol.cantidad * ol.monto_unitario, a.precios_incluyen_iva, a.tasa_iva)::numeric AS monto
    FROM public.operaciones_lineas ol
    JOIN public.operaciones o ON o.id = ol.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_asignacion_arreglo oa ON oa.operacion_id = o.id
    JOIN public.arreglos a ON a.id = oa.arreglo_id
    WHERE (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    UNION ALL
    SELECT NULL::uuid AS empleado_id,
      public.importe_comercial_arreglo(c.costo, a.precios_incluyen_iva, a.tasa_iva) AS monto
    FROM public.arreglos a
    CROSS JOIN LATERAL (
      SELECT costo FROM public.detalle_form_custom WHERE arreglo_id = a.id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) c
    WHERE a.tasa_iva IS NOT NULL
      AND (p_from IS NULL OR a.fecha >= p_from)
      AND (p_to IS NULL OR a.fecha < p_to)
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
  ),
  agg AS (
    SELECT
      COALESCE(e.nombre || ' ' || e.apellido, 'Sin empleado')::text AS label,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(l.monto), 0)::numeric AS monto
    FROM lineas l
    LEFT JOIN public.empleados e ON e.id = l.empleado_id
    GROUP BY 1
  ),
  ranked AS (
    SELECT agg.label, agg.cantidad, agg.monto,
           ROW_NUMBER() OVER (ORDER BY agg.monto DESC, agg.label ASC) AS rn
    FROM agg
  ),
  top_rows AS (
    SELECT label, cantidad, monto FROM ranked WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT 'Otros'::text AS label, COALESCE(SUM(cantidad), 0)::int AS cantidad, COALESCE(SUM(monto), 0)::numeric AS monto
    FROM ranked WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.label, s.cantidad, s.monto
  FROM (
    SELECT label, cantidad, monto, 0 AS sort_group FROM top_rows
    UNION ALL
    SELECT label, cantidad, monto, 1 AS sort_group FROM otros WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.monto DESC, s.label ASC;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_empleado"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_empleado"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_facturacion_por_empleado"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_facturacion_por_empleado"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_facturacion_por_empleado"(integer, timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.dashboard_ingresos_por_periodo (
  p_from      timestamp with time zone,
  p_to        timestamp with time zone,
  p_taller_id uuid                     DEFAULT NULL::uuid
)
  RETURNS TABLE (
    label        text,
    mano_de_obra numeric,
    repuestos    numeric,
    ventas       numeric
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  b record;
BEGIN
  SELECT * INTO b FROM public.dashboard_pick_bucket(p_from, p_to);
  RETURN QUERY
  WITH slots AS (
    SELECT generate_series(
      date_trunc(b.trunc_name, p_from),
      date_trunc(b.trunc_name, p_to - interval '1 second'),
      b.step
    ) AS slot_start
  ),
  ra AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(public.importe_comercial_arreglo(ol.cantidad * ol.monto_unitario, a.precios_incluyen_iva, a.tasa_iva)), 0)::numeric AS rep
    FROM public.arreglos a
    JOIN public.operaciones_asignacion_arreglo oa ON oa.arreglo_id = a.id
    JOIN public.operaciones o  ON o.id = oa.operacion_id AND o.tipo = 'ASIGNACION_ARREGLO'
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  ia AS (
    SELECT date_trunc(b.trunc_name, a.fecha) AS slot_start,
           COALESCE(SUM(a.precio_final), 0)::numeric AS total
    FROM public.arreglos a
    WHERE a.fecha >= p_from AND a.fecha < p_to
      AND (p_taller_id IS NULL OR a.taller_id = p_taller_id)
      AND (a.estado IS NULL OR a.estado <> 'PRESUPUESTO')
    GROUP BY 1
  ),
  vd AS (
    SELECT date_trunc(b.trunc_name, o.fecha) AS slot_start,
           COALESCE(SUM(ol.cantidad * ol.monto_unitario), 0)::numeric AS ventas
    FROM public.operaciones o
    JOIN public.operaciones_lineas ol ON ol.operacion_id = o.id
    WHERE o.tipo = 'VENTA' AND o.fecha >= p_from AND o.fecha < p_to
      AND (p_taller_id IS NULL OR o.taller_id = p_taller_id)
    GROUP BY 1
  )
  SELECT to_char(s.slot_start, b.label_fmt),
         GREATEST(COALESCE(ia.total, 0) - COALESCE(ra.rep, 0), 0),
         COALESCE(ra.rep, 0),
         COALESCE(vd.ventas, 0)
  FROM slots s
  LEFT JOIN ra USING (slot_start)
  LEFT JOIN ia USING (slot_start)
  LEFT JOIN vd USING (slot_start)
  ORDER BY s.slot_start;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_ingresos_por_periodo"(timestamp WITH time zone, timestamp WITH time zone, uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.dashboard_sum_ingresos (
  p_from timestamp with time zone,
  p_to   timestamp with time zone
)
  RETURNS numeric
  LANGUAGE sql
  SET search_path TO 'public'
  AS $function$
  SELECT COALESCE(SUM(public.importe_comercial_arreglo(CASE WHEN d.horas_facturadas IS NULL
    THEN d.cantidad * d.precio_hora_facturada
    ELSE d.horas_facturadas * d.cantidad * d.precio_hora_facturada END, a.precios_incluyen_iva, a.tasa_iva)), 0)::numeric
  FROM public.arreglos a
  JOIN public.detalle_arreglo d ON d.arreglo_id = a.id
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$function$;

GRANT EXECUTE ON FUNCTION "public"."dashboard_sum_ingresos"(timestamp WITH time zone, timestamp WITH time zone) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."dashboard_sum_ingresos"(timestamp WITH time zone, timestamp WITH time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."dashboard_sum_ingresos"(timestamp WITH time zone, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."dashboard_sum_ingresos"(timestamp WITH time zone, timestamp WITH time zone) TO "postgres";

CREATE TRIGGER b2c197_guardar_iva
  BEFORE INSERT OR UPDATE ON public.arreglos
  FOR EACH ROW EXECUTE FUNCTION public._b2c197_guardar_iva();
CREATE TRIGGER trg_b2c197_recalcular_formulario
  AFTER INSERT OR DELETE OR UPDATE OF costo ON public.detalle_form_custom
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_precio_final_arreglo();
