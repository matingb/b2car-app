CREATE POLICY "facturacion_certificados_tenant_admin_delete" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING
    (((bucket_id = 'facturacion-certificados'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text) AND ((auth.jwt() ->> 'user_role'::text) =
    'admin'::text)));

CREATE POLICY "facturacion_certificados_tenant_admin_insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'facturacion-certificados'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text) AND ((auth.jwt() ->> 'user_role'::text) =
    'admin'::text)));

CREATE POLICY "facturacion_certificados_tenant_admin_update" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING
    (((bucket_id = 'facturacion-certificados'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text) AND ((auth.jwt() ->> 'user_role'::text) =
    'admin'::text)))
  WITH
    CHECK
    (((bucket_id = 'facturacion-certificados'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text) AND ((auth.jwt() ->> 'user_role'::text) =
    'admin'::text)));

CREATE POLICY "facturacion_certificados_tenant_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'facturacion-certificados'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text)));

CREATE POLICY "facturacion_comprobantes_tenant_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'facturacion-comprobantes'::text) AND (split_part(name, '/'::text, 1) = (public.current_tenant_id())::text)));
