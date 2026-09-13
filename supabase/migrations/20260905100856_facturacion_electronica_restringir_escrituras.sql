-- Los registros fiscales se escriben exclusivamente a través de Route
-- Handlers con service_role. authenticated conserva sólo la lectura RLS.
REVOKE ALL ON TABLE public.facturacion_configuracion_tenant,
  public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos,
  public.facturacion_emision_leases FROM authenticated;

GRANT SELECT ON TABLE public.facturacion_configuracion_tenant,
  public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_configuracion_tenant,
  public.facturas_electronicas,
  public.facturas_electronicas_lineas,
  public.facturacion_emision_intentos,
  public.facturacion_emision_leases TO service_role;
