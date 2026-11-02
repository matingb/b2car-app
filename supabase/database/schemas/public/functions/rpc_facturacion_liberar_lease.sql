CREATE FUNCTION public.rpc_facturacion_liberar_lease (
  p_emisor_cuit      text,
  p_punto_venta      integer,
  p_tipo_comprobante smallint,
  p_lease_token      uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  DELETE FROM public.facturacion_emision_leases
  WHERE emisor_cuit = p_emisor_cuit
    AND punto_venta = p_punto_venta
    AND tipo_comprobante = p_tipo_comprobante
    AND lease_token = p_lease_token;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.rpc_facturacion_liberar_lease(text, integer, smallint, uuid) TO service_role;