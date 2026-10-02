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
    v_protegido := public.facturacion_arreglo_autorizado(v_arreglo_id);
    IF NOT v_protegido THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    IF TG_OP = 'DELETE'
       OR OLD.vehiculo_id IS DISTINCT FROM NEW.vehiculo_id
       OR OLD.taller_id IS DISTINCT FROM NEW.taller_id
       OR OLD.fecha IS DISTINCT FROM NEW.fecha
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
  IF v_arreglo_id IS NOT NULL AND public.facturacion_arreglo_autorizado(v_arreglo_id) THEN
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
