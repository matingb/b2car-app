CREATE OR REPLACE FUNCTION public._finanzas_insertar_movimiento (
  p_tenant_id             uuid,
  p_tipo                  text,
  p_cuenta_id             uuid,
  p_importe               numeric,
  p_fecha                 timestamp with time zone DEFAULT now(),
  p_descripcion           text                     DEFAULT NULL::text,
  p_categoria_gasto       text                     DEFAULT NULL::text,
  p_arreglo_id            uuid                     DEFAULT NULL::uuid,
  p_operacion_id          uuid                     DEFAULT NULL::uuid,
  p_reversa_movimiento_id uuid                     DEFAULT NULL::uuid,
  p_grupo_id              uuid                     DEFAULT NULL::uuid,
  p_idempotency_key       uuid                     DEFAULT NULL::uuid,
  p_metadata              jsonb                    DEFAULT '{}'::jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
  RETURN public._ledger_insertar(p_operacion_id, p_tenant_id, p_cuenta_id, p_importe, p_fecha);
END; $function$;

GRANT EXECUTE
  ON FUNCTION "public"."_finanzas_insertar_movimiento"(uuid, text, uuid, numeric, timestamp WITH time zone, text, text, uuid, uuid, uuid, uuid, uuid, jsonb)
  TO "anon", "authenticated";

GRANT EXECUTE
  ON FUNCTION "public"."_finanzas_insertar_movimiento"(uuid, text, uuid, numeric, timestamp WITH time zone, text, text, uuid, uuid, uuid, uuid, uuid, jsonb)
  TO "service_role";

REVOKE ALL ON FUNCTION "public"."_finanzas_insertar_movimiento"(uuid, text, uuid, numeric, timestamp WITH time zone, text, text, uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC;

REVOKE ALL
  ON FUNCTION "public"."_finanzas_insertar_movimiento"(uuid, text, uuid, numeric, timestamp WITH time zone, text, text, uuid, uuid, uuid, uuid, uuid, jsonb)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."_finanzas_insertar_movimiento"(uuid, text, uuid, numeric, timestamp WITH time zone, text, text, uuid, uuid, uuid, uuid, uuid, jsonb)
  TO "postgres";
