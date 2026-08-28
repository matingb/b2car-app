-- Las leases son coordinación interna de Route Handlers; ningún usuario de
-- PostgREST debe poder leerlas ni modificarlas.
REVOKE ALL ON TABLE public.facturacion_emision_leases FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturacion_emision_leases TO service_role;
