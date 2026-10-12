-- B2C-202: el taller siempre emite Remitos R como autoimpresor.
-- Normalizamos configuraciones anteriores sin alterar snapshots de remitos ya emitidos.
-- El UPDATE no modifica numeración; el trigger de numeración puede rechazar filas
-- legadas cuyo próximo número ya era inconsistente. Este bloque es atómico: ante
-- cualquier error se revierten tanto el UPDATE como el cambio de estado del trigger.
DO $migration$
BEGIN
  EXECUTE 'ALTER TABLE public.remitos_configuracion DISABLE TRIGGER remitos_configuracion_validar_numeracion';

  UPDATE public.remitos_configuracion
  SET r_autoimpresor = true,
      r_imprenta_razon_social = NULL,
      r_imprenta_cuit = NULL,
      r_imprenta_fecha_impresion = NULL,
      r_imprenta_habilitacion = NULL
  WHERE NOT r_autoimpresor
     OR r_imprenta_razon_social IS NOT NULL
     OR r_imprenta_cuit IS NOT NULL
     OR r_imprenta_fecha_impresion IS NOT NULL
     OR r_imprenta_habilitacion IS NOT NULL;

  EXECUTE 'ALTER TABLE public.remitos_configuracion ENABLE TRIGGER remitos_configuracion_validar_numeracion';

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.remitos_configuracion'::regclass
      AND tgname = 'remitos_configuracion_validar_numeracion'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'El trigger de numeración de remitos no quedó habilitado';
  END IF;
END;
$migration$;

ALTER TABLE public.remitos_configuracion
  ALTER COLUMN r_autoimpresor SET DEFAULT true,
  ADD CONSTRAINT remitos_configuracion_r_autoimpresor_check CHECK (r_autoimpresor);

-- La emisión conserva el arreglo y su factura; los conceptos vinculados controlan cantidades.
-- Reemplazamos también la firma anterior que no recibía el arreglo de origen.
DROP FUNCTION IF EXISTS public.rpc_remitos_emitir(uuid, text, text, uuid, jsonb, jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION public.rpc_remitos_emitir(p_idempotency_key uuid, p_ambiente text, p_clase text, p_arreglo_id uuid, p_factura_id uuid, p_destinatario jsonb, p_transportista jsonb, p_observaciones text, p_lineas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_hoy date := public._remitos_hoy();
  v_fiscal public.facturacion_configuracion_ambiente%ROWTYPE;
  v_config public.remitos_configuracion%ROWTYPE;
  v_factura public.facturas_electronicas%ROWTYPE;
  v_factura_id uuid := p_factura_id;
  v_existente public.remitos%ROWTYPE;
  v_remito_id uuid;
  v_numero integer;
  v_punto integer;
  v_tipo smallint;
  v_cai text;
  v_cai_vencimiento date;
  v_impresion jsonb;
  v_emisor jsonb;
  v_destinatario jsonb;
  v_transportista jsonb;
  v_observaciones text := NULLIF(btrim(coalesce(p_observaciones, '')), '');
  v_dest_nombre text;
  v_dest_domicilio text;
  v_dest_tipo_doc text;
  v_dest_documento text;
  v_dest_condicion text;
  v_dest_cliente_id uuid;
  v_dest_cliente_txt text;
  v_transp_nombre text;
  v_transp_domicilio text;
  v_transp_cuit text;
  v_item record;
  v_cantidad_txt text;
  v_cantidad numeric;
  v_codigo text;
  v_descripcion text;
  v_item_observaciones text;
  v_codigo_txt text;
  v_descripcion_txt text;
  v_factura_linea_txt text;
  v_factura_linea_id uuid;
  v_exceso record;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  IF NOT public._b2c179_tiene_permiso('facturas:edit') THEN
    RAISE EXCEPTION 'No tenés permiso para emitir remitos' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'La clave de idempotencia es obligatoria'; END IF;
  IF p_ambiente IS NULL OR p_ambiente NOT IN ('HOMOLOGACION', 'PRODUCCION') THEN
    RAISE EXCEPTION 'El ambiente fiscal no es válido';
  END IF;
  IF p_clase IS NULL OR p_clase NOT IN ('R', 'X') THEN
    RAISE EXCEPTION 'Seleccioná el tipo de remito (R o X)';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'El remito debe tener al menos un ítem';
  END IF;
  IF jsonb_array_length(p_lineas) > 200 THEN
    RAISE EXCEPTION 'El remito admite hasta 200 ítems';
  END IF;
  IF char_length(v_observaciones) > 1000 THEN
    RAISE EXCEPTION 'Las observaciones del remito no pueden superar los 1000 caracteres';
  END IF;

  -- Destinatario
  IF p_destinatario IS NULL OR jsonb_typeof(p_destinatario) <> 'object' THEN
    RAISE EXCEPTION 'Completá los datos del destinatario';
  END IF;
  v_dest_nombre := NULLIF(btrim(coalesce(p_destinatario ->> 'nombre', '')), '');
  IF v_dest_nombre IS NULL THEN RAISE EXCEPTION 'El nombre del destinatario es obligatorio'; END IF;
  IF char_length(v_dest_nombre) > 200 THEN
    RAISE EXCEPTION 'El nombre del destinatario no puede superar los 200 caracteres';
  END IF;
  v_dest_domicilio := NULLIF(btrim(coalesce(p_destinatario ->> 'domicilio', '')), '');
  IF char_length(v_dest_domicilio) > 300 THEN
    RAISE EXCEPTION 'El domicilio del destinatario no puede superar los 300 caracteres';
  END IF;
  v_dest_tipo_doc := NULLIF(btrim(coalesce(p_destinatario ->> 'tipoDocumento', '')), '');
  v_dest_documento := NULLIF(regexp_replace(coalesce(p_destinatario ->> 'numeroDocumento', ''), '\D', '', 'g'), '');
  IF v_dest_tipo_doc IS NOT NULL AND v_dest_tipo_doc NOT IN ('80', '86', '96', '99') THEN
    RAISE EXCEPTION 'El tipo de documento del destinatario no es válido';
  END IF;
  IF v_dest_tipo_doc IS NULL OR v_dest_tipo_doc = '99' THEN
    v_dest_tipo_doc := NULL;
    v_dest_documento := NULL;
  ELSIF v_dest_documento IS NULL THEN
    RAISE EXCEPTION 'Completá el número de documento del destinatario';
  ELSIF v_dest_tipo_doc = '96' AND v_dest_documento !~ '^[0-9]{7,8}$' THEN
    RAISE EXCEPTION 'El DNI del destinatario debe tener entre 7 y 8 dígitos';
  ELSIF v_dest_tipo_doc IN ('80', '86') AND v_dest_documento !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'El CUIT o CUIL del destinatario debe tener 11 dígitos';
  END IF;
  v_dest_condicion := NULLIF(btrim(coalesce(p_destinatario ->> 'condicionIvaReceptorId', '')), '');
  IF v_dest_condicion IS NOT NULL AND v_dest_condicion NOT IN ('1', '4', '5', '6', '15') THEN
    RAISE EXCEPTION 'La condición IVA del destinatario no es válida';
  END IF;
  v_dest_cliente_txt := NULLIF(btrim(coalesce(p_destinatario ->> 'clienteId', '')), '');
  IF v_dest_cliente_txt IS NOT NULL THEN
    IF v_dest_cliente_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'El cliente del destinatario no es válido';
    END IF;
    v_dest_cliente_id := v_dest_cliente_txt::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = v_dest_cliente_id AND c.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'Cliente no encontrado';
    END IF;
  END IF;
  v_destinatario := jsonb_build_object(
    'clienteId', v_dest_cliente_id,
    'nombre', v_dest_nombre,
    'domicilio', v_dest_domicilio,
    'tipoDocumento', v_dest_tipo_doc::integer,
    'numeroDocumento', v_dest_documento,
    'condicionIvaReceptorId', v_dest_condicion::integer,
    'condicionIva', CASE v_dest_condicion
      WHEN '1' THEN 'Responsable inscripto'
      WHEN '4' THEN 'IVA exento'
      WHEN '5' THEN 'Consumidor final'
      WHEN '6' THEN 'Monotributista'
      WHEN '15' THEN 'IVA no alcanzado'
      ELSE NULL
    END
  );

  -- Transportista (opcional)
  IF p_transportista IS NOT NULL AND jsonb_typeof(p_transportista) <> 'null' THEN
    IF jsonb_typeof(p_transportista) <> 'object' THEN
      RAISE EXCEPTION 'Los datos del transportista no son válidos';
    END IF;
    v_transp_nombre := NULLIF(btrim(coalesce(p_transportista ->> 'nombre', '')), '');
    v_transp_domicilio := NULLIF(btrim(coalesce(p_transportista ->> 'domicilio', '')), '');
    v_transp_cuit := NULLIF(regexp_replace(coalesce(p_transportista ->> 'cuit', ''), '\D', '', 'g'), '');
    IF v_transp_nombre IS NOT NULL OR v_transp_domicilio IS NOT NULL OR v_transp_cuit IS NOT NULL THEN
      IF v_transp_nombre IS NULL THEN RAISE EXCEPTION 'El nombre del transportista es obligatorio'; END IF;
      IF char_length(v_transp_nombre) > 200 THEN
        RAISE EXCEPTION 'El nombre del transportista no puede superar los 200 caracteres';
      END IF;
      IF char_length(v_transp_domicilio) > 300 THEN
        RAISE EXCEPTION 'El domicilio del transportista no puede superar los 300 caracteres';
      END IF;
      IF v_transp_cuit IS NOT NULL AND v_transp_cuit !~ '^[0-9]{11}$' THEN
        RAISE EXCEPTION 'El CUIT del transportista debe tener 11 dígitos';
      END IF;
      v_transportista := jsonb_build_object(
        'nombre', v_transp_nombre, 'domicilio', v_transp_domicilio, 'cuit', v_transp_cuit
      );
    END IF;
  END IF;

  -- Emisor: siempre desde la configuración fiscal guardada, nunca desde el caller.
  SELECT * INTO v_fiscal
  FROM public.facturacion_configuracion_ambiente f
  WHERE f.tenant_id = v_tenant AND f.ambiente = p_ambiente;
  IF NOT FOUND
     OR NULLIF(btrim(coalesce(v_fiscal.razon_social, '')), '') IS NULL
     OR coalesce(v_fiscal.cuit, '') !~ '^[0-9]{11}$'
     OR NULLIF(btrim(coalesce(v_fiscal.domicilio, '')), '') IS NULL
     OR v_fiscal.inicio_actividades IS NULL THEN
    RAISE EXCEPTION 'Completá los datos fiscales del emisor en Configuración > Facturación antes de emitir remitos';
  END IF;
  v_emisor := jsonb_build_object(
    'razonSocial', btrim(v_fiscal.razon_social),
    'nombreFantasia', NULLIF(btrim(coalesce(v_fiscal.nombre_fantasia, '')), ''),
    'cuit', v_fiscal.cuit,
    'domicilio', btrim(v_fiscal.domicilio),
    'ingresosBrutos', NULLIF(btrim(coalesce(v_fiscal.ingresos_brutos, '')), ''),
    'inicioActividades', v_fiscal.inicio_actividades,
    'condicionIvaEmisor', v_fiscal.condicion_iva_emisor,
    'condicionIva', CASE WHEN v_fiscal.condicion_iva_emisor = 'RESPONSABLE_INSCRIPTO'
      THEN 'Responsable inscripto' ELSE 'Monotributista' END
  );

  -- La fila de configuración serializa las emisiones del tenant y ambiente.
  SELECT * INTO v_config
  FROM public.remitos_configuracion c
  WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.remitos_configuracion (tenant_id, ambiente)
    VALUES (v_tenant, p_ambiente)
    ON CONFLICT (tenant_id, ambiente) DO NOTHING;
    SELECT * INTO v_config
    FROM public.remitos_configuracion c
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente
    FOR UPDATE;
  END IF;

  -- Idempotencia (después del lock para que un reintento concurrente vea la emisión previa).
  SELECT * INTO v_existente
  FROM public.remitos r
  WHERE r.tenant_id = v_tenant AND r.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.clase <> p_clase
       OR v_existente.ambiente <> p_ambiente
       OR v_existente.arreglo_id IS DISTINCT FROM p_arreglo_id
       OR ((p_arreglo_id IS NULL OR p_factura_id IS NOT NULL)
           AND v_existente.factura_id IS DISTINCT FROM p_factura_id) THEN
      RAISE EXCEPTION 'La clave de idempotencia ya pertenece a otro remito';
    END IF;
    RETURN v_existente.id;
  END IF;

  IF p_arreglo_id IS NOT NULL THEN
    PERFORM 1
    FROM public.arreglos a
    WHERE a.id = p_arreglo_id AND a.tenant_id = v_tenant
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Arreglo no encontrado'; END IF;
    IF v_factura_id IS NULL THEN
      SELECT f.id INTO v_factura_id
      FROM public.facturas_electronicas f
      WHERE f.arreglo_id = p_arreglo_id AND f.tenant_id = v_tenant
        AND f.ambiente = p_ambiente AND f.documento_tipo = 'FACTURA'
        AND f.estado = 'AUTORIZADA';
    END IF;
  END IF;

  IF v_factura_id IS NOT NULL THEN
    -- Serializa los controles de cantidades por factura sin bloquear la fila fiscal.
    PERFORM pg_advisory_xact_lock(hashtextextended('remitos_factura_' || v_factura_id::text, 0));
    SELECT * INTO v_factura
    FROM public.facturas_electronicas f
    WHERE f.id = v_factura_id AND f.tenant_id = v_tenant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
    IF v_factura.documento_tipo <> 'FACTURA' OR v_factura.estado <> 'AUTORIZADA' THEN
      RAISE EXCEPTION 'Solo se pueden generar remitos desde facturas autorizadas';
    END IF;
    IF v_factura.ambiente <> p_ambiente THEN
      RAISE EXCEPTION 'La factura pertenece a otro ambiente fiscal';
    END IF;
    IF p_arreglo_id IS NOT NULL AND v_factura.arreglo_id IS DISTINCT FROM p_arreglo_id THEN
      RAISE EXCEPTION 'La factura no corresponde al arreglo de origen';
    END IF;
  END IF;

  -- Ítems
  FOR v_item IN
    SELECT e.value AS item, e.ordinality AS ordinal
    FROM jsonb_array_elements(p_lineas) WITH ORDINALITY AS e(value, ordinality)
  LOOP
    IF jsonb_typeof(v_item.item) <> 'object' THEN
      RAISE EXCEPTION 'El ítem % del remito no es válido', v_item.ordinal;
    END IF;

    v_cantidad_txt := btrim(coalesce(v_item.item ->> 'cantidad', ''));
    IF v_cantidad_txt !~ '^[0-9]+(\.[0-9]{1,4})?$' THEN
      RAISE EXCEPTION 'La cantidad del ítem % debe ser un número positivo con hasta 4 decimales', v_item.ordinal;
    END IF;
    v_cantidad := v_cantidad_txt::numeric;
    IF v_cantidad <= 0 OR v_cantidad >= 10000000000 THEN
      RAISE EXCEPTION 'La cantidad del ítem % debe ser mayor a cero', v_item.ordinal;
    END IF;

    v_item_observaciones := NULLIF(btrim(coalesce(v_item.item ->> 'observaciones', '')), '');
    IF char_length(v_item_observaciones) > 500 THEN
      RAISE EXCEPTION 'Las observaciones del ítem % no pueden superar los 500 caracteres', v_item.ordinal;
    END IF;

    v_factura_linea_txt := NULLIF(btrim(coalesce(v_item.item ->> 'factura_linea_id', '')), '');
    v_factura_linea_id := NULL;

    IF v_factura_linea_txt IS NOT NULL THEN
      IF v_factura_id IS NULL THEN
        RAISE EXCEPTION 'Los ítems de un remito sin factura no pueden referenciar líneas de factura';
      END IF;
      IF v_factura_linea_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'La referencia de factura del ítem % no es válida', v_item.ordinal;
      END IF;
      v_factura_linea_id := v_factura_linea_txt::uuid;
      PERFORM 1
      FROM public.facturas_electronicas_lineas fl
      WHERE fl.id = v_factura_linea_id AND fl.factura_id = v_factura_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El ítem % no corresponde a una línea de la factura', v_item.ordinal;
      END IF;
    END IF;

    v_codigo_txt := NULLIF(btrim(coalesce(v_item.item ->> 'codigo', '')), '');
    IF char_length(v_codigo_txt) > 100 THEN
      RAISE EXCEPTION 'El código del ítem % no puede superar los 100 caracteres', v_item.ordinal;
    END IF;
    v_descripcion_txt := NULLIF(btrim(coalesce(v_item.item ->> 'descripcion', '')), '');
    IF v_descripcion_txt IS NULL THEN
      RAISE EXCEPTION 'La descripción del ítem % es obligatoria', v_item.ordinal;
    END IF;
    IF char_length(v_descripcion_txt) > 500 THEN
      RAISE EXCEPTION 'La descripción del ítem % no puede superar los 500 caracteres', v_item.ordinal;
    END IF;
    v_codigo := v_codigo_txt;
    v_descripcion := v_descripcion_txt;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'ordinal', v_item.ordinal,
      'codigo', v_codigo,
      'descripcion', v_descripcion,
      'observaciones', v_item_observaciones,
      'cantidad', v_cantidad,
      'factura_linea_id', v_factura_linea_id
    ));
  END LOOP;

  IF v_factura_id IS NOT NULL THEN
    SELECT fl.descripcion, fl.cantidad, coalesce(previo.total, 0) AS remitido, nuevo.total AS nuevo
    INTO v_exceso
    FROM (
      SELECT i.factura_linea_id, sum(i.cantidad) AS total
      FROM jsonb_to_recordset(v_items) AS i(factura_linea_id uuid, cantidad numeric)
      WHERE i.factura_linea_id IS NOT NULL
      GROUP BY i.factura_linea_id
    ) nuevo
    JOIN public.facturas_electronicas_lineas fl ON fl.id = nuevo.factura_linea_id
    LEFT JOIN LATERAL (
      SELECT sum(rl.cantidad) AS total
      FROM public.remitos_lineas rl
      WHERE rl.factura_linea_id = fl.id
    ) previo ON true
    WHERE coalesce(previo.total, 0) + nuevo.total > fl.cantidad
    ORDER BY fl.ordinal
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'La cantidad a remitir de "%" supera la cantidad facturada disponible (%)',
        v_exceso.descripcion, trim_scale(greatest(v_exceso.cantidad - v_exceso.remitido, 0));
    END IF;
  END IF;

  -- Numeración y reglas propias de cada clase
  IF p_clase = 'R' THEN
    IF v_config.r_cai IS NULL THEN
      RAISE EXCEPTION 'Para emitir un Remito R configurá el CAI en Configuración > Remitos';
    END IF;
    IF v_config.r_cai_vencimiento IS NULL THEN
      RAISE EXCEPTION 'El CAI del Remito R no tiene fecha de vencimiento configurada';
    END IF;
    IF v_config.r_cai_vencimiento < v_hoy THEN
      RAISE EXCEPTION 'El CAI del Remito R está vencido (venció el %)', to_char(v_config.r_cai_vencimiento, 'DD/MM/YYYY');
    END IF;
    IF v_config.r_punto_emision IS NULL THEN
      RAISE EXCEPTION 'Configurá el punto de emisión del Remito R en Configuración > Remitos';
    END IF;
    v_punto := v_config.r_punto_emision;
    v_numero := v_config.r_proximo_numero;
    IF (v_config.r_numero_desde IS NOT NULL AND v_numero < v_config.r_numero_desde)
       OR (v_config.r_numero_hasta IS NOT NULL AND v_numero > v_config.r_numero_hasta) THEN
      RAISE EXCEPTION 'El número R %-% está fuera del rango autorizado (% a %)',
        lpad(v_punto::text, 5, '0'), lpad(v_numero::text, 8, '0'),
        coalesce(lpad(v_config.r_numero_desde::text, 8, '0'), 'sin mínimo'),
        coalesce(lpad(v_config.r_numero_hasta::text, 8, '0'), 'sin máximo');
    END IF;
    IF v_numero >= 99999999 THEN
      RAISE EXCEPTION 'Se agotó la numeración del Remito R para el punto de emisión %. Configurá un nuevo punto de emisión.',
        lpad(v_punto::text, 5, '0');
    END IF;

    v_tipo := 91;
    v_cai := v_config.r_cai;
    v_cai_vencimiento := v_config.r_cai_vencimiento;
    v_impresion := jsonb_build_object(
      'autoimpresor', true,
      'numeroDesde', v_config.r_numero_desde,
      'numeroHasta', v_config.r_numero_hasta,
      'inicioActividades', v_config.r_inicio_actividades,
      'imprenta', NULL
    );

    UPDATE public.remitos_configuracion c
    SET r_proximo_numero = v_numero + 1
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente;
  ELSE
    v_punto := v_config.x_punto_emision;
    v_numero := v_config.x_proximo_numero;
    IF v_numero >= 99999999 THEN
      RAISE EXCEPTION 'Se agotó la numeración del Remito X para el punto de emisión %. Configurá un nuevo punto de emisión.',
        lpad(v_punto::text, 5, '0');
    END IF;

    UPDATE public.remitos_configuracion c
    SET x_proximo_numero = v_numero + 1
    WHERE c.tenant_id = v_tenant AND c.ambiente = p_ambiente;
  END IF;

  INSERT INTO public.remitos (
    tenant_id, ambiente, clase, tipo_comprobante, punto_emision, numero, fecha_emision,
     idempotency_key, arreglo_id, factura_id, factura_asociada_at, factura_asociada_by,
    emisor_snapshot, destinatario_snapshot, transportista_snapshot,
    cai, cai_vencimiento, impresion_snapshot, observaciones, created_by
  ) VALUES (
    v_tenant, p_ambiente, p_clase, v_tipo, v_punto, v_numero, v_hoy,
     p_idempotency_key, p_arreglo_id, v_factura_id,
    CASE WHEN v_factura_id IS NULL THEN NULL ELSE now() END,
    CASE WHEN v_factura_id IS NULL THEN NULL ELSE auth.uid() END,
    v_emisor, v_destinatario, v_transportista,
    v_cai, v_cai_vencimiento, v_impresion, v_observaciones, auth.uid()
  )
  RETURNING id INTO v_remito_id;

  INSERT INTO public.remitos_lineas (
    remito_id, ordinal, codigo, descripcion, observaciones, cantidad, factura_linea_id
  )
  SELECT v_remito_id, i.ordinal, i.codigo, i.descripcion, i.observaciones, i.cantidad, i.factura_linea_id
  FROM jsonb_to_recordset(v_items) AS i(
    ordinal smallint, codigo text, descripcion text, observaciones text, cantidad numeric, factura_linea_id uuid
  );

  RETURN v_remito_id;
END;
$function$
;

REVOKE ALL ON FUNCTION "public"."rpc_remitos_emitir"(uuid, text, text, uuid, uuid, jsonb, jsonb, text, jsonb) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."rpc_remitos_emitir"(uuid, text, text, uuid, uuid, jsonb, jsonb, text, jsonb) TO "authenticated", "service_role";
