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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rpc_facturacion_adquirir_lease"(text, integer, smallint, uuid, integer) TO "postgres";
