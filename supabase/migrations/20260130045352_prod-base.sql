


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."tipo_cliente" AS ENUM (
    'particular',
    'empresa'
);


ALTER TYPE "public"."tipo_cliente" OWNER TO "postgres";


CREATE TYPE "public"."tipo_operacion" AS ENUM (
    'COMPRA',
    'VENTA',
    'ASIGNACION_ARREGLO',
    'AJUSTE',
    'TRANSFERENCIA'
);


ALTER TYPE "public"."tipo_operacion" OWNER TO "postgres";


CREATE TYPE "public"."turno_estado" AS ENUM (
    'pendiente',
    'confirmado',
    'cancelado',
    'finalizado'
);


ALTER TYPE "public"."turno_estado" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select (auth.jwt() ->> 'tenant_id')::uuid;
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_claims"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  claims      jsonb;
  tenant_uuid uuid;
  tenant_name text;
  user_id     uuid;
  user_role   text;
BEGIN
  claims := event->'claims';

  IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
    RETURN event;
  END IF;

  user_id := (claims->>'sub')::uuid;

  SELECT tm.tenant_id, tm.rol
    INTO tenant_uuid, user_role
  FROM public.tenant_members tm
  WHERE tm.cliente_id = user_id
  LIMIT 1;

  SELECT t.nombre
    INTO tenant_name
  FROM public.tenants t
  WHERE t.id = tenant_uuid;


  IF tenant_uuid IS NULL THEN
    RETURN event;
  END IF;

  claims := claims
    || jsonb_build_object('tenant_id', tenant_uuid)
    || jsonb_build_object('user_role', user_role)
    || jsonb_build_object('tenant_name', tenant_name);

  -- 4. Actualizar claims dentro de event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;$$;


ALTER FUNCTION "public"."custom_claims"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_clientes_nuevos_por_dia"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("label" "text", "valor" integer)
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', p_from),
      date_trunc('day', p_to - interval '1 second'),
      interval '1 day'
    ) AS day
  ),
  agg AS (
    SELECT date_trunc('day', c.fecha_creacion) AS day, COUNT(*)::int AS valor
    FROM public.clientes c
    WHERE c.fecha_creacion >= p_from
      AND c.fecha_creacion < p_to
    GROUP BY 1
  )
  SELECT
    to_char(days.day::date, 'DD/MM') AS label,
    COALESCE(agg.valor, 0)::int AS valor
  FROM days
  LEFT JOIN agg USING (day)
  ORDER BY days.day ASC;
$$;


ALTER FUNCTION "public"."dashboard_clientes_nuevos_por_dia"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_count_arreglos"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM public.arreglos;
$$;


ALTER FUNCTION "public"."dashboard_count_arreglos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_count_arreglos_by_pago"("p_esta_pago" boolean) RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int
  FROM public.arreglos
  WHERE esta_pago = p_esta_pago;
$$;


ALTER FUNCTION "public"."dashboard_count_arreglos_by_pago"("p_esta_pago" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_count_clientes"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM public.clientes;
$$;


ALTER FUNCTION "public"."dashboard_count_clientes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_count_vehiculos"() RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::int FROM public.vehiculos;
$$;


ALTER FUNCTION "public"."dashboard_count_vehiculos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_sum_ingresos"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS numeric
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(SUM(a.precio_final), 0)::numeric
  FROM public.arreglos a
  WHERE a.fecha >= p_from
    AND a.fecha < p_to;
$$;


ALTER FUNCTION "public"."dashboard_sum_ingresos"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_tipos_con_ingresos"("top" integer DEFAULT 4) RETURNS TABLE("tipo" "text", "cantidad" integer, "ingresos" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$WITH agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(a.tipo), ''), 'Sin tipo')::text AS tipo,
      COUNT(*)::int AS cantidad,
      COALESCE(SUM(a.precio_final), 0)::numeric AS ingresos
    FROM public.arreglos a
    GROUP BY 1
  ),
  ranked AS (
    SELECT
      a.tipo,
      a.cantidad,
      a.ingresos,
      ROW_NUMBER() OVER (ORDER BY a.cantidad DESC, a.tipo ASC) AS rn
    FROM agg a
  ),
  top_rows AS (
    SELECT tipo, cantidad, ingresos
    FROM ranked
    WHERE rn <= GREATEST(COALESCE(top, 0), 0)
  ),
  otros AS (
    SELECT
      'Otros'::text AS tipo,
      COALESCE(SUM(cantidad), 0)::int AS cantidad,
      COALESCE(SUM(ingresos), 0)::numeric AS ingresos
    FROM ranked
    WHERE rn > GREATEST(COALESCE(top, 0), 0)
  )
  SELECT s.tipo, s.cantidad, s.ingresos
  FROM (
    SELECT tipo, cantidad, ingresos, 0 AS sort_group
    FROM top_rows
    UNION ALL
    SELECT tipo, cantidad, ingresos, 1 AS sort_group
    FROM otros
    WHERE cantidad > 0
  ) s
  ORDER BY s.sort_group ASC, s.cantidad DESC, s.tipo ASC;$$;


ALTER FUNCTION "public"."dashboard_tipos_con_ingresos"("top" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_empresa"("empresa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Eliminar de la tabla empresas
  DELETE FROM empresas WHERE id = empresa_id;
  
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = empresa_id;
END;
$$;


ALTER FUNCTION "public"."delete_empresa"("empresa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_particular"("particular_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Eliminar de la tabla particulares
  DELETE FROM particulares WHERE id = particular_id;
  
  -- Eliminar de la tabla clientes
  DELETE FROM clientes WHERE id = particular_id;
END;
$$;


ALTER FUNCTION "public"."delete_particular"("particular_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_crear_operacion_con_stock"("p_tipo" "public"."tipo_operacion", "p_taller_id" "uuid", "p_lineas" "jsonb", "p_arreglo_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id   uuid;
  v_operacion_id uuid;

  l jsonb;
  v_producto_id uuid;
  v_cantidad    int;
  v_monto       numeric(12,2);
  v_delta       int;

  v_rowcount int;
BEGIN
  -- tenant desde JWT del caller
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'JWT sin tenant_id';
  END IF;

  IF p_lineas IS NULL
     OR jsonb_typeof(p_lineas) <> 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'lineas debe ser un array no vacío';
  END IF;

  -- ESTO BLOQUEA LA FILA DE STOCK PARA QUE TRANSACCIONES ESPEREN A QUE TERMINE LA ANTERIOR
  PERFORM 1
  FROM public.stocks s
  WHERE s.taller_id = p_taller_id
    AND s.producto_id IN (
      SELECT DISTINCT (line_elem ->> 'producto_id')::uuid
      FROM jsonb_array_elements(p_lineas) AS line_elem
    )
  FOR UPDATE;

  --  ----- CREA OPERACION --------
  INSERT INTO public.operaciones (tenant_id, tipo, taller_id)
  VALUES (v_tenant_id, p_tipo, p_taller_id)
  RETURNING id INTO v_operacion_id;

  -- vínculo con arreglo
  IF p_tipo = 'ASIGNACION_ARREGLO' THEN
    IF p_arreglo_id IS NULL THEN
      RAISE EXCEPTION 'arreglo_id requerido para ASIGNACION_ARREGLO';
    END IF;

    INSERT INTO public.operaciones_asignacion_arreglo (operacion_id, arreglo_id)
    VALUES (v_operacion_id, p_arreglo_id);
  END IF;

  -- líneas + stock
  FOR l IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_producto_id := (l ->> 'producto_id')::uuid;
    v_cantidad    := (l ->> 'cantidad')::int;
    v_monto       := COALESCE((l ->> 'monto_unitario')::numeric, 0);

    IF v_producto_id IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'linea inválida (producto_id %, cantidad %)', v_producto_id, v_cantidad;
    END IF;

    v_delta :=
      CASE p_tipo
        WHEN 'COMPRA' THEN  v_cantidad
        WHEN 'VENTA' THEN  -v_cantidad
        WHEN 'ASIGNACION_ARREGLO' THEN -v_cantidad
        WHEN 'AJUSTE' THEN
          COALESCE((l ->> 'delta_cantidad')::int, v_cantidad) -- TODO ESTO NO SE CALCULA ASI
        ELSE 0
      END;

    IF v_delta = 0 THEN
      RAISE EXCEPTION 'delta inválido para producto %', v_producto_id;
    END IF;

    INSERT INTO public.operaciones_lineas (
      operacion_id, producto_id, cantidad, monto_unitario, delta_cantidad
    )
    VALUES (
      v_operacion_id, v_producto_id, v_cantidad, v_monto, v_delta
    );

    -- aplicar stock
    IF v_delta < 0 THEN
      UPDATE public.stocks s
      SET cantidad = s.cantidad + v_delta,
          updated_at = now()
      WHERE s.taller_id  = p_taller_id
        AND s.producto_id = v_producto_id
        AND s.cantidad >= (-v_delta);

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount = 0 THEN
        RAISE EXCEPTION 'STOCK_INSUFICIENTE (producto %)', v_producto_id;
      END IF;

    ELSE
      INSERT INTO public.stocks (tenant_id, taller_id, producto_id, cantidad)
      VALUES (v_tenant_id, p_taller_id, v_producto_id, v_delta)
      ON CONFLICT (taller_id, producto_id)
      DO UPDATE SET
        cantidad   = public.stocks.cantidad + EXCLUDED.cantidad,
        updated_at = now();
    END IF;
  END LOOP;

  RETURN v_operacion_id;
END;
$$;


ALTER FUNCTION "public"."rpc_crear_operacion_con_stock"("p_tipo" "public"."tipo_operacion", "p_taller_id" "uuid", "p_lineas" "jsonb", "p_arreglo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."arreglos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehiculo_id" "uuid" NOT NULL,
    "tipo" character varying(100),
    "kilometraje_leido" integer,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "observaciones" "text",
    "precio_final" numeric(10,2),
    "precio_sin_iva" numeric(10,2),
    "esta_pago" boolean DEFAULT false,
    "extra_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "descripcion" "text",
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."arreglos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_cliente" "public"."tipo_cliente",
    "puntaje" integer DEFAULT 0,
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    CONSTRAINT "clientes_tipo_cliente_check" CHECK ((("tipo_cliente")::"text" = ANY (ARRAY[('particular'::character varying)::"text", ('empresa'::character varying)::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cuit" "text" NOT NULL,
    "direccion" "text",
    "nombre" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "telefono" "text"
);


ALTER TABLE "public"."empresas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "tipo" "public"."tipo_operacion" NOT NULL,
    "taller_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."operaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operaciones_asignacion_arreglo" (
    "operacion_id" "uuid" NOT NULL,
    "arreglo_id" "uuid" NOT NULL
);


ALTER TABLE "public"."operaciones_asignacion_arreglo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operaciones_lineas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operacion_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer DEFAULT 0 NOT NULL,
    "monto_unitario" numeric(12,2) DEFAULT 0 NOT NULL,
    "delta_cantidad" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."operaciones_lineas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."particulares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(100) NOT NULL,
    "apellido" character varying(100) NOT NULL,
    "telefono" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "direccion" "text"
);


ALTER TABLE "public"."particulares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "marca" "text",
    "modelo" "text",
    "descripcion" "text",
    "precio_unitario" numeric DEFAULT 0 NOT NULL,
    "costo_unitario" numeric DEFAULT 0 NOT NULL,
    "proveedor" "text",
    "categorias" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "productos_costo_nonneg" CHECK (("costo_unitario" >= (0)::numeric)),
    CONSTRAINT "productos_precio_nonneg" CHECK (("precio_unitario" >= (0)::numeric))
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."representantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text" NOT NULL,
    "telefono" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."representantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "taller_id" "uuid" NOT NULL,
    "producto_id" "uuid" NOT NULL,
    "cantidad" integer DEFAULT 0 NOT NULL,
    "stock_minimo" integer DEFAULT 0 NOT NULL,
    "stock_maximo" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stocks_cantidad_nonneg" CHECK (("cantidad" >= 0)),
    CONSTRAINT "stocks_max_nonneg" CHECK (("stock_maximo" >= 0)),
    CONSTRAINT "stocks_min_nonneg" CHECK (("stock_minimo" >= 0))
);


ALTER TABLE "public"."stocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."talleres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "ubicacion" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."talleres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_members" (
    "cliente_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rol" character varying(50) DEFAULT 'admin'::character varying
);


ALTER TABLE "public"."tenant_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "estado" character varying(50) DEFAULT 'activo'::character varying NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_actualizacion" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."turnos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "hora" time without time zone NOT NULL,
    "duracion" integer,
    "vehiculo_id" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "tipo" "text",
    "estado" "public"."turno_estado" DEFAULT 'pendiente'::"public"."turno_estado" NOT NULL,
    "descripcion" "text",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."turnos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehiculos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "patente" "text" NOT NULL,
    "marca" "text" NOT NULL,
    "modelo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fecha_patente" "text",
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    "nro_interno" "text"
);


ALTER TABLE "public"."vehiculos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_turnos_con_detalle" WITH ("security_invoker"='on') AS
 SELECT "t"."id",
    "t"."fecha",
    "t"."hora",
    "t"."duracion",
    "t"."vehiculo_id",
    "t"."cliente_id",
    "t"."tipo",
    "t"."estado",
    "t"."descripcion",
    "t"."observaciones",
    "v"."id" AS "vehiculo_id_full",
    "v"."cliente_id" AS "vehiculo_cliente_id",
    "v"."patente",
    "v"."marca",
    "v"."modelo",
    "v"."fecha_patente",
    "v"."nro_interno",
    "c"."id" AS "cliente_id_full",
    "c"."tipo_cliente",
    "p"."nombre" AS "particular_nombre",
    "p"."apellido" AS "particular_apellido",
    "p"."telefono" AS "particular_telefono",
    "p"."email" AS "particular_email",
    "p"."direccion" AS "particular_direccion",
    "e"."nombre" AS "empresa_nombre",
    "e"."telefono" AS "empresa_telefono",
    "e"."email" AS "empresa_email",
    "e"."direccion" AS "empresa_direccion",
    "e"."cuit" AS "empresa_cuit"
   FROM (((("public"."turnos" "t"
     LEFT JOIN "public"."vehiculos" "v" ON (("t"."vehiculo_id" = "v"."id")))
     LEFT JOIN "public"."clientes" "c" ON (("t"."cliente_id" = "c"."id")))
     LEFT JOIN "public"."particulares" "p" ON (("c"."id" = "p"."id")))
     LEFT JOIN "public"."empresas" "e" ON (("c"."id" = "e"."id")));


ALTER VIEW "public"."vista_turnos_con_detalle" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_vehiculos_con_clientes" WITH ("security_invoker"='on') AS
 SELECT "v"."id",
    COALESCE(NULLIF(TRIM(BOTH FROM "concat"("p"."nombre", ' ', "p"."apellido")), ''::"text"), "e"."nombre") AS "nombre_cliente",
    "v"."patente",
    "v"."marca",
    "v"."modelo",
    "v"."fecha_patente",
    "v"."nro_interno"
   FROM ((("public"."vehiculos" "v"
     JOIN "public"."clientes" "c" ON (("v"."cliente_id" = "c"."id")))
     LEFT JOIN "public"."particulares" "p" ON (("c"."id" = "p"."id")))
     LEFT JOIN "public"."empresas" "e" ON (("c"."id" = "e"."id")));


ALTER VIEW "public"."vista_vehiculos_con_clientes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "arreglos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operaciones_lineas"
    ADD CONSTRAINT "operaciones_lineas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operaciones"
    ADD CONSTRAINT "operaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."particulares"
    ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operaciones_asignacion_arreglo"
    ADD CONSTRAINT "pk_operaciones_asignacion_arreglo" PRIMARY KEY ("operacion_id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."representantes"
    ADD CONSTRAINT "representantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_taller_producto_unique_constraint" UNIQUE ("taller_id", "producto_id");



ALTER TABLE ONLY "public"."talleres"
    ADD CONSTRAINT "talleres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_cliente_id_tenant_id_key" UNIQUE ("cliente_id", "tenant_id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("cliente_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_patente_tenant_unique" UNIQUE ("patente", "tenant_id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_arreglos_fecha" ON "public"."arreglos" USING "btree" ("fecha");



CREATE INDEX "idx_arreglos_tenant_id" ON "public"."arreglos" USING "btree" ("tenant_id");



CREATE INDEX "idx_arreglos_updated_at" ON "public"."arreglos" USING "btree" ("updated_at");



CREATE INDEX "idx_arreglos_vehiculo_id" ON "public"."arreglos" USING "btree" ("vehiculo_id");



CREATE INDEX "idx_clientes_tenant_id" ON "public"."clientes" USING "btree" ("tenant_id");



CREATE INDEX "idx_clientes_tipo" ON "public"."clientes" USING "btree" ("tipo_cliente");



CREATE INDEX "idx_op_asig_arreglo_arreglo_id" ON "public"."operaciones_asignacion_arreglo" USING "btree" ("arreglo_id");





CREATE INDEX "idx_operaciones_tenant" ON "public"."operaciones" USING "btree" ("tenant_id");



CREATE INDEX "idx_operaciones_tenant_taller" ON "public"."operaciones" USING "btree" ("tenant_id", "taller_id");



CREATE INDEX "idx_operaciones_tenant_tipo_created" ON "public"."operaciones" USING "btree" ("tenant_id", "tipo", "created_at" DESC);



CREATE INDEX "idx_personas_email" ON "public"."particulares" USING "btree" ("email");



CREATE INDEX "idx_representantes_empresa_id" ON "public"."representantes" USING "btree" ("empresa_id");



CREATE INDEX "idx_turnos_cliente" ON "public"."turnos" USING "btree" ("cliente_id");



CREATE INDEX "idx_turnos_estado" ON "public"."turnos" USING "btree" ("estado");



CREATE INDEX "idx_turnos_fecha" ON "public"."turnos" USING "btree" ("fecha");



CREATE INDEX "idx_turnos_tenant_fecha_hora" ON "public"."turnos" USING "btree" ("tenant_id", "fecha", "hora");



CREATE INDEX "idx_turnos_vehiculo" ON "public"."turnos" USING "btree" ("vehiculo_id");



CREATE INDEX "idx_vehiculos_cliente_id" ON "public"."vehiculos" USING "btree" ("cliente_id");



CREATE INDEX "idx_vehiculos_patente" ON "public"."vehiculos" USING "btree" ("patente");



CREATE INDEX "idx_vehiculos_tenant_id" ON "public"."vehiculos" USING "btree" ("tenant_id");



CREATE INDEX "productos_tenant_id_idx" ON "public"."productos" USING "btree" ("tenant_id");



CREATE INDEX "stocks_productoid_idx" ON "public"."stocks" USING "btree" ("producto_id");



CREATE INDEX "stocks_tallerid_idx" ON "public"."stocks" USING "btree" ("taller_id");



CREATE INDEX "stocks_tenant_id_idx" ON "public"."stocks" USING "btree" ("tenant_id");



CREATE INDEX "talleres_tenant_id_idx" ON "public"."talleres" USING "btree" ("tenant_id");


CREATE OR REPLACE TRIGGER "productos_set_updated_at" BEFORE UPDATE ON "public"."productos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_arreglos_updated_at" BEFORE UPDATE ON "public"."arreglos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "stocks_set_updated_at" BEFORE UPDATE ON "public"."stocks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "talleres_set_updated_at" BEFORE UPDATE ON "public"."talleres" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "arreglos_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "fk_arreglos_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "fk_clientes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "fk_vehiculos_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."operaciones_asignacion_arreglo"
    ADD CONSTRAINT "operaciones_asignacion_arreglo_arreglo_id_fkey" FOREIGN KEY ("arreglo_id") REFERENCES "public"."arreglos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operaciones_asignacion_arreglo"
    ADD CONSTRAINT "operaciones_asignacion_arreglo_operacion_id_fkey" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operaciones_lineas"
    ADD CONSTRAINT "operaciones_lineas_operacion_id_fkey" FOREIGN KEY ("operacion_id") REFERENCES "public"."operaciones"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."operaciones"
    ADD CONSTRAINT "operaciones_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operaciones"
    ADD CONSTRAINT "operaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."particulares"
    ADD CONSTRAINT "particulares_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."representantes"
    ADD CONSTRAINT "representantes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_taller_id_fkey" FOREIGN KEY ("taller_id") REFERENCES "public"."talleres"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."talleres"
    ADD CONSTRAINT "talleres_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id");



ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE "public"."arreglos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_access" ON "public"."empresas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_access" ON "public"."particulares" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_access" ON "public"."representantes" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operaciones_asignacion_arreglo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operaciones_lineas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."particulares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."representantes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."talleres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_access" ON "public"."arreglos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."clientes" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."operaciones" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."operaciones_asignacion_arreglo" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."operaciones" "o"
  WHERE (("o"."id" = "operaciones_asignacion_arreglo"."operacion_id") AND ("o"."tenant_id" = "public"."current_tenant_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."operaciones" "o"
  WHERE (("o"."id" = "operaciones_asignacion_arreglo"."operacion_id") AND ("o"."tenant_id" = "public"."current_tenant_id"())))));



CREATE POLICY "tenant_access" ON "public"."operaciones_lineas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."operaciones" "o"
  WHERE (("o"."id" = "operaciones_lineas"."operacion_id") AND ("o"."tenant_id" = "public"."current_tenant_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."operaciones" "o"
  WHERE (("o"."id" = "operaciones_lineas"."operacion_id") AND ("o"."tenant_id" = "public"."current_tenant_id"())))));



CREATE POLICY "tenant_access" ON "public"."productos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."stocks" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."talleres" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."turnos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



CREATE POLICY "tenant_access" ON "public"."vehiculos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));



ALTER TABLE "public"."tenant_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turnos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehiculos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

























































































































































GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."dashboard_clientes_nuevos_por_dia"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_clientes_nuevos_por_dia"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_clientes_nuevos_por_dia"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos_by_pago"("p_esta_pago" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos_by_pago"("p_esta_pago" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_count_arreglos_by_pago"("p_esta_pago" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_count_clientes"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_count_clientes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_count_clientes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_count_vehiculos"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_count_vehiculos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_count_vehiculos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_sum_ingresos"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_sum_ingresos"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_sum_ingresos"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_tipos_con_ingresos"("top" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_tipos_con_ingresos"("top" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_tipos_con_ingresos"("top" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_crear_operacion_con_stock"("p_tipo" "public"."tipo_operacion", "p_taller_id" "uuid", "p_lineas" "jsonb", "p_arreglo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_crear_operacion_con_stock"("p_tipo" "public"."tipo_operacion", "p_taller_id" "uuid", "p_lineas" "jsonb", "p_arreglo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_crear_operacion_con_stock"("p_tipo" "public"."tipo_operacion", "p_taller_id" "uuid", "p_lineas" "jsonb", "p_arreglo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."arreglos" TO "anon";
GRANT ALL ON TABLE "public"."arreglos" TO "authenticated";
GRANT ALL ON TABLE "public"."arreglos" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";



GRANT ALL ON TABLE "public"."operaciones" TO "anon";
GRANT ALL ON TABLE "public"."operaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."operaciones" TO "service_role";



GRANT ALL ON TABLE "public"."operaciones_asignacion_arreglo" TO "anon";
GRANT ALL ON TABLE "public"."operaciones_asignacion_arreglo" TO "authenticated";
GRANT ALL ON TABLE "public"."operaciones_asignacion_arreglo" TO "service_role";



GRANT ALL ON TABLE "public"."operaciones_lineas" TO "anon";
GRANT ALL ON TABLE "public"."operaciones_lineas" TO "authenticated";
GRANT ALL ON TABLE "public"."operaciones_lineas" TO "service_role";



GRANT ALL ON TABLE "public"."particulares" TO "anon";
GRANT ALL ON TABLE "public"."particulares" TO "authenticated";
GRANT ALL ON TABLE "public"."particulares" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."representantes" TO "anon";
GRANT ALL ON TABLE "public"."representantes" TO "authenticated";
GRANT ALL ON TABLE "public"."representantes" TO "service_role";



GRANT ALL ON TABLE "public"."stocks" TO "anon";
GRANT ALL ON TABLE "public"."stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."stocks" TO "service_role";



GRANT ALL ON TABLE "public"."talleres" TO "anon";
GRANT ALL ON TABLE "public"."talleres" TO "authenticated";
GRANT ALL ON TABLE "public"."talleres" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_members" TO "anon";
GRANT ALL ON TABLE "public"."tenant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."turnos" TO "anon";
GRANT ALL ON TABLE "public"."turnos" TO "authenticated";
GRANT ALL ON TABLE "public"."turnos" TO "service_role";



GRANT ALL ON TABLE "public"."vehiculos" TO "anon";
GRANT ALL ON TABLE "public"."vehiculos" TO "authenticated";
GRANT ALL ON TABLE "public"."vehiculos" TO "service_role";



GRANT ALL ON TABLE "public"."vista_turnos_con_detalle" TO "anon";
GRANT ALL ON TABLE "public"."vista_turnos_con_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_turnos_con_detalle" TO "service_role";



GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "anon";
GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































