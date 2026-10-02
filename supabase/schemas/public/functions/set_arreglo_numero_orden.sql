CREATE OR REPLACE FUNCTION public.set_arreglo_numero_orden()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := public.current_tenant_id();
    END IF;
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id es requerido para generar numero_orden';
    END IF;
    IF NEW.numero_orden IS NULL THEN
      -- Bloqueo consultivo a nivel de transacción por tenant para evitar colisiones concurrentes (64-bit bigint)
      PERFORM pg_advisory_xact_lock(hashtextextended('arreglos_numero_orden_' || NEW.tenant_id::text, 0));
      SELECT coalesce(max(numero_orden), 0) + 1
        INTO NEW.numero_orden
        FROM public.arreglos
       WHERE tenant_id = NEW.tenant_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.numero_orden IS NULL THEN
      NEW.numero_orden := OLD.numero_orden;
    END IF;
    IF OLD.numero_orden IS NOT NULL AND NEW.numero_orden IS DISTINCT FROM OLD.numero_orden THEN
      RAISE EXCEPTION 'No se permite modificar el numero_orden de un arreglo';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_arreglo_numero_orden"() TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_arreglo_numero_orden"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_arreglo_numero_orden"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_arreglo_numero_orden"() TO "postgres";
