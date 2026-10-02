CREATE OR REPLACE FUNCTION public._insert_arreglo_base (
  p_vehiculo_id       uuid,
  p_taller_id         uuid,
  p_estado            public.estado_arreglo,
  p_descripcion       text,
  p_kilometraje_leido integer,
  p_fecha             timestamp with time zone,
  p_observaciones     text,
  p_precio_final      numeric,
  p_precio_sin_iva    numeric,
  p_esta_pago         boolean,
  p_extra_data        jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_tenant_id uuid := (auth.jwt() ->> 'tenant_id')::uuid;
  v_arreglo_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'JWT sin tenant_id'; END IF;
  INSERT INTO public.arreglos (
    tenant_id, vehiculo_id, taller_id, estado, descripcion,
    kilometraje_leido, fecha, observaciones, precio_final, precio_sin_iva,
    esta_pago, extra_data
  ) VALUES (
    v_tenant_id, p_vehiculo_id, p_taller_id,
    coalesce(p_estado, 'SIN_INICIAR'::public.estado_arreglo),
    p_descripcion, coalesce(p_kilometraje_leido, 0),
    p_fecha, p_observaciones,
    coalesce(p_precio_final, 0), coalesce(p_precio_sin_iva, 0),
    coalesce(p_esta_pago, false), p_extra_data
  ) RETURNING id INTO v_arreglo_id;
  RETURN v_arreglo_id;
END;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."_insert_arreglo_base"(uuid, uuid, public.estado_arreglo, text, integer, timestamp WITH time zone, text, numeric, numeric, boolean, jsonb)
  TO PUBLIC, "anon", "authenticated";

GRANT EXECUTE
  ON FUNCTION "public"."_insert_arreglo_base"(uuid, uuid, public.estado_arreglo, text, integer, timestamp WITH time zone, text, numeric, numeric, boolean, jsonb)
  TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."_insert_arreglo_base"(uuid, uuid, public.estado_arreglo, text, integer, timestamp WITH time zone, text, numeric, numeric, boolean, jsonb)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."_insert_arreglo_base"(uuid, uuid, public.estado_arreglo, text, integer, timestamp WITH time zone, text, numeric, numeric, boolean, jsonb)
  TO "postgres";
