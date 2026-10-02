CREATE OR REPLACE FUNCTION public._lock_arreglo_del_tenant (
  p_arreglo_id uuid,
  p_taller_id  uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;
  PERFORM 1
  FROM public.arreglos a
  WHERE a.id = p_arreglo_id
    AND a.tenant_id = v_tenant_id
    AND a.taller_id = p_taller_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'arreglo no encontrado';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."_lock_arreglo_del_tenant"(uuid, uuid) TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."_lock_arreglo_del_tenant"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."_lock_arreglo_del_tenant"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."_lock_arreglo_del_tenant"(uuid, uuid) TO "postgres";
