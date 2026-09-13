-- Habilita operaciones de facturacion electronica y gestion de credenciales
-- para usuarios autenticados dentro de su propio tenant mediante RLS y RPC seguras,
-- eliminando la necesidad de service_role para operar.

-- 1. Membresia de tenant: permitir al usuario consultar su propio rol y tenant
DROP POLICY IF EXISTS tenant_members_select_own ON public.tenant_members;
CREATE POLICY tenant_members_select_own
  ON public.tenant_members
  FOR SELECT TO authenticated
  USING (cliente_id = auth.uid());

-- 2. Configuracion de facturacion por ambiente:
-- Lectura permitida para cualquier usuario autenticado de su tenant (necesaria para emitir facturas)
-- Modificaciones restringidas estrictamente a administradores del tenant
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_configuracion_ambiente TO authenticated;

DROP POLICY IF EXISTS facturacion_config_ambiente_lectura_admin ON public.facturacion_configuracion_ambiente;
DROP POLICY IF EXISTS facturacion_config_ambiente_select_tenant ON public.facturacion_configuracion_ambiente;
CREATE POLICY facturacion_config_ambiente_select_tenant
  ON public.facturacion_configuracion_ambiente
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS facturacion_config_ambiente_insert_admin ON public.facturacion_configuracion_ambiente;
CREATE POLICY facturacion_config_ambiente_insert_admin
  ON public.facturacion_configuracion_ambiente
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

DROP POLICY IF EXISTS facturacion_config_ambiente_update_admin ON public.facturacion_configuracion_ambiente;
CREATE POLICY facturacion_config_ambiente_update_admin
  ON public.facturacion_configuracion_ambiente
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (auth.jwt() ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

DROP POLICY IF EXISTS facturacion_config_ambiente_delete_admin ON public.facturacion_configuracion_ambiente;
CREATE POLICY facturacion_config_ambiente_delete_admin
  ON public.facturacion_configuracion_ambiente
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 3. Facturas electronicas
GRANT SELECT, INSERT, UPDATE ON TABLE public.facturas_electronicas TO authenticated;

DROP POLICY IF EXISTS facturas_electronicas_insert_tenant ON public.facturas_electronicas;
CREATE POLICY facturas_electronicas_insert_tenant
  ON public.facturas_electronicas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS facturas_electronicas_update_tenant ON public.facturas_electronicas;
CREATE POLICY facturas_electronicas_update_tenant
  ON public.facturas_electronicas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- 4. Lineas de facturas electronicas
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturas_electronicas_lineas TO authenticated;

DROP POLICY IF EXISTS facturas_electronicas_lineas_insert_tenant ON public.facturas_electronicas_lineas;
CREATE POLICY facturas_electronicas_lineas_insert_tenant
  ON public.facturas_electronicas_lineas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS facturas_electronicas_lineas_update_tenant ON public.facturas_electronicas_lineas;
CREATE POLICY facturas_electronicas_lineas_update_tenant
  ON public.facturas_electronicas_lineas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS facturas_electronicas_lineas_delete_tenant ON public.facturas_electronicas_lineas;
CREATE POLICY facturas_electronicas_lineas_delete_tenant
  ON public.facturas_electronicas_lineas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

-- 5. Intentos de emision fiscal (lectura y registro por tenant)
GRANT SELECT, INSERT, UPDATE ON TABLE public.facturacion_emision_intentos TO authenticated;

DROP POLICY IF EXISTS facturacion_intentos_lectura_admin ON public.facturacion_emision_intentos;
DROP POLICY IF EXISTS facturacion_intentos_select_tenant ON public.facturacion_emision_intentos;
CREATE POLICY facturacion_intentos_select_tenant
  ON public.facturacion_emision_intentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS facturacion_intentos_insert_tenant ON public.facturacion_emision_intentos;
CREATE POLICY facturacion_intentos_insert_tenant
  ON public.facturacion_emision_intentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS facturacion_intentos_update_tenant ON public.facturacion_emision_intentos;
CREATE POLICY facturacion_intentos_update_tenant
  ON public.facturacion_emision_intentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas_electronicas f
      WHERE f.id = factura_id AND f.tenant_id = public.current_tenant_id()
    )
  );

-- 6. RPC: Preparar documento fiscal con aislamiento estricto de tenant
CREATE OR REPLACE FUNCTION public.rpc_facturacion_preparar_documento(
  p_encabezado jsonb, p_lineas jsonb, p_factura_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      otros_impuestos_nacionales, contenido_hash, created_by
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
      p_encabezado->>'contenido_hash', NULLIF(p_encabezado->>'created_by','')::uuid
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_facturacion_preparar_documento(jsonb, jsonb, uuid) TO authenticated;

-- 7. RPCs para leases de concurrencia en emision protegidas contra DoS entre tenants
CREATE OR REPLACE FUNCTION public.rpc_facturacion_adquirir_lease(
  p_emisor_cuit text, p_punto_venta integer, p_tipo_comprobante smallint,
  p_lease_token uuid, p_segundos integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tenant uuid := public.current_tenant_id();
BEGIN
  IF p_emisor_cuit !~ '^[0-9]{11}$' OR p_punto_venta IS NULL OR p_punto_venta <= 0
     OR p_tipo_comprobante NOT IN (1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53)
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_facturacion_adquirir_lease(text, integer, smallint, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) TO authenticated;

-- 8. Parametros normativos (lectura publica para autenticados)
GRANT SELECT ON TABLE public.facturacion_parametros_normativos TO authenticated;

DROP POLICY IF EXISTS facturacion_parametros_normativos_lectura ON public.facturacion_parametros_normativos;
CREATE POLICY facturacion_parametros_normativos_lectura
  ON public.facturacion_parametros_normativos
  FOR SELECT TO authenticated
  USING (true);

-- 9. Storage: Certificados fiscales privados
-- Lectura: Cualquier usuario autenticado dentro de su propio tenant (para firmar en emision)
-- Escritura/Modificacion: Restringida a administradores del tenant
DROP POLICY IF EXISTS "facturacion_certificados_tenant_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "facturacion_certificados_tenant_select" ON storage.objects;
CREATE POLICY "facturacion_certificados_tenant_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'facturacion-certificados'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "facturacion_certificados_tenant_admin_insert" ON storage.objects;
CREATE POLICY "facturacion_certificados_tenant_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'facturacion-certificados'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

DROP POLICY IF EXISTS "facturacion_certificados_tenant_admin_update" ON storage.objects;
CREATE POLICY "facturacion_certificados_tenant_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'facturacion-certificados'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
    AND (auth.jwt() ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    bucket_id = 'facturacion-certificados'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

DROP POLICY IF EXISTS "facturacion_certificados_tenant_admin_delete" ON storage.objects;
CREATE POLICY "facturacion_certificados_tenant_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'facturacion-certificados'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- 10. Storage: Comprobantes PDF (restringido al tenant)
DROP POLICY IF EXISTS "facturacion_comprobantes_tenant_select" ON storage.objects;
CREATE POLICY "facturacion_comprobantes_tenant_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'facturacion-comprobantes'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "facturacion_comprobantes_tenant_insert" ON storage.objects;
CREATE POLICY "facturacion_comprobantes_tenant_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'facturacion-comprobantes'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "facturacion_comprobantes_tenant_update" ON storage.objects;
CREATE POLICY "facturacion_comprobantes_tenant_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'facturacion-comprobantes'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'facturacion-comprobantes'
    AND split_part(name, '/', 1) = public.current_tenant_id()::text
  );
