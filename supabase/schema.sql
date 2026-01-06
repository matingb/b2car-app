--
-- PostgreSQL database dump
--

-- \restrict 7PHhNTrHZ2qWJDRoZvmhtpveRTQ1tVgU7RVzPblxHTZCXP6qWYufzHgHNRZa4vI

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: tipo_cliente; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."tipo_cliente" AS ENUM (
    'particular',
    'empresa'
);


ALTER TYPE "public"."tipo_cliente" OWNER TO "postgres";

--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select (auth.jwt() ->> 'tenant_id')::uuid;
$$;


ALTER FUNCTION "public"."current_tenant_id"() OWNER TO "postgres";

--
-- Name: custom_claims("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."custom_claims"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claims      jsonb;
  tenant_uuid uuid;
  user_id     uuid;
  user_role   text;
BEGIN
  -- 1. Obtener los claims originales
  claims := event->'claims';

  -- Validación mínima
  IF claims IS NULL OR jsonb_typeof(claims) IS NULL THEN
    RETURN event;
  END IF;

  -- El sub SIEMPRE está presente en autenticación de Supabase
  user_id := (claims->>'sub')::uuid;

  -- 2. Buscar tenant_id y rol desde tenant_members
  SELECT tm.tenant_id, tm.rol
    INTO tenant_uuid, user_role
  FROM public.tenant_members tm
  WHERE tm.cliente_id = user_id
  LIMIT 1;

  -- Si este usuario no tiene tenant, devolver tal cual
  IF tenant_uuid IS NULL THEN
    RETURN event;
  END IF;

  -- 3. Insertar directamente los claims custom
  claims := claims
    || jsonb_build_object('tenant_id', tenant_uuid)
    || jsonb_build_object('user_role', user_role);

  -- 4. Actualizar claims dentro de event
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;


ALTER FUNCTION "public"."custom_claims"("event" "jsonb") OWNER TO "postgres";

--
-- Name: delete_empresa("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: delete_particular("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.fecha_actualizacion = NOW();
   RETURN NEW;
END;
$$;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: arreglos; Type: TABLE; Schema: public; Owner: postgres
--

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "descripcion" "text",
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL
);


ALTER TABLE "public"."arreglos" OWNER TO "postgres";

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_cliente" "public"."tipo_cliente",
    "puntaje" integer DEFAULT 0,
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" DEFAULT (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid" NOT NULL,
    CONSTRAINT "clientes_tipo_cliente_check" CHECK ((("tipo_cliente")::"text" = ANY (ARRAY[('particular'::character varying)::"text", ('empresa'::character varying)::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";

--
-- Name: empresas; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: particulares; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: representantes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."representantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text" NOT NULL,
    "telefono" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."representantes" OWNER TO "postgres";

--
-- Name: tenant_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."tenant_members" (
    "cliente_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rol" character varying(50) DEFAULT 'admin'::character varying
);


ALTER TABLE "public"."tenant_members" OWNER TO "postgres";

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "estado" character varying(50) DEFAULT 'activo'::character varying NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_actualizacion" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";

--
-- Name: vehiculos; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: vista_vehiculos_con_clientes; Type: VIEW; Schema: public; Owner: postgres
--

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

--
-- Name: arreglos arreglos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "arreglos_pkey" PRIMARY KEY ("id");


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");


--
-- Name: particulares personas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."particulares"
    ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");


--
-- Name: representantes representantes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."representantes"
    ADD CONSTRAINT "representantes_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_members tenant_members_cliente_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_cliente_id_tenant_id_key" UNIQUE ("cliente_id", "tenant_id");


--
-- Name: tenant_members tenant_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("cliente_id");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");


--
-- Name: vehiculos vehiculos_patente_tenant_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_patente_tenant_unique" UNIQUE ("patente", "tenant_id");


--
-- Name: vehiculos vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id");


--
-- Name: idx_arreglos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_arreglos_fecha" ON "public"."arreglos" USING "btree" ("fecha");

CREATE INDEX "idx_arreglos_updated_at" ON "public"."arreglos" USING "btree" ("updated_at");


--
-- Name: idx_arreglos_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_arreglos_tenant_id" ON "public"."arreglos" USING "btree" ("tenant_id");


--
-- Name: idx_arreglos_vehiculo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_arreglos_vehiculo_id" ON "public"."arreglos" USING "btree" ("vehiculo_id");


--
-- Name: idx_clientes_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_tenant_id" ON "public"."clientes" USING "btree" ("tenant_id");


--
-- Name: idx_clientes_tipo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_clientes_tipo" ON "public"."clientes" USING "btree" ("tipo_cliente");


--
-- Name: idx_personas_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_personas_email" ON "public"."particulares" USING "btree" ("email");


--
-- Name: idx_representantes_empresa_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_representantes_empresa_id" ON "public"."representantes" USING "btree" ("empresa_id");


--
-- Name: idx_vehiculos_cliente_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vehiculos_cliente_id" ON "public"."vehiculos" USING "btree" ("cliente_id");


--
-- Name: idx_vehiculos_patente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vehiculos_patente" ON "public"."vehiculos" USING "btree" ("patente");


--
-- Name: idx_vehiculos_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vehiculos_tenant_id" ON "public"."vehiculos" USING "btree" ("tenant_id");


--
-- Name: tenants update_tenant_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_tenant_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "set_arreglos_updated_at" BEFORE UPDATE ON "public"."arreglos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: arreglos arreglos_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "arreglos_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE CASCADE;


--
-- Name: empresas empresas_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;


--
-- Name: arreglos fk_arreglos_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."arreglos"
    ADD CONSTRAINT "fk_arreglos_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;


--
-- Name: clientes fk_clientes_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "fk_clientes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;


--
-- Name: vehiculos fk_vehiculos_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "fk_vehiculos_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT;


--
-- Name: particulares particulares_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."particulares"
    ADD CONSTRAINT "particulares_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;


--
-- Name: representantes representantes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."representantes"
    ADD CONSTRAINT "representantes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;


--
-- Name: tenant_members tenant_members_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "auth"."users"("id");


--
-- Name: tenant_members tenant_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: vehiculos vehiculos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vehiculos"
    ADD CONSTRAINT "vehiculos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;


--
-- Name: arreglos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."arreglos" ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas auth_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auth_access" ON "public"."empresas" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: particulares auth_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auth_access" ON "public"."particulares" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: representantes auth_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auth_access" ON "public"."representantes" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;

--
-- Name: particulares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."particulares" ENABLE ROW LEVEL SECURITY;

--
-- Name: representantes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."representantes" ENABLE ROW LEVEL SECURITY;

--
-- Name: arreglos tenant_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_access" ON "public"."arreglos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));


--
-- Name: clientes tenant_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_access" ON "public"."clientes" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));


--
-- Name: vehiculos tenant_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_access" ON "public"."vehiculos" TO "authenticated" USING (("tenant_id" = "public"."current_tenant_id"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id"()));


--
-- Name: tenant_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tenant_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;

--
-- Name: vehiculos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."vehiculos" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";


--
-- Name: FUNCTION "current_tenant_id"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id"() TO "service_role";


--
-- Name: FUNCTION "custom_claims"("event" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_claims"("event" "jsonb") TO "supabase_auth_admin";


--
-- Name: FUNCTION "delete_empresa"("empresa_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_empresa"("empresa_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "delete_particular"("particular_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_particular"("particular_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: TABLE "arreglos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."arreglos" TO "anon";
GRANT ALL ON TABLE "public"."arreglos" TO "authenticated";
GRANT ALL ON TABLE "public"."arreglos" TO "service_role";


--
-- Name: TABLE "clientes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";


--
-- Name: TABLE "empresas"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."empresas" TO "anon";
GRANT ALL ON TABLE "public"."empresas" TO "authenticated";
GRANT ALL ON TABLE "public"."empresas" TO "service_role";


--
-- Name: TABLE "particulares"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."particulares" TO "anon";
GRANT ALL ON TABLE "public"."particulares" TO "authenticated";
GRANT ALL ON TABLE "public"."particulares" TO "service_role";


--
-- Name: TABLE "representantes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."representantes" TO "anon";
GRANT ALL ON TABLE "public"."representantes" TO "authenticated";
GRANT ALL ON TABLE "public"."representantes" TO "service_role";


--
-- Name: TABLE "tenant_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."tenant_members" TO "anon";
GRANT ALL ON TABLE "public"."tenant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_members" TO "service_role";


--
-- Name: TABLE "tenants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";


--
-- Name: TABLE "vehiculos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."vehiculos" TO "anon";
GRANT ALL ON TABLE "public"."vehiculos" TO "authenticated";
GRANT ALL ON TABLE "public"."vehiculos" TO "service_role";


--
-- Name: TABLE "vista_vehiculos_con_clientes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "anon";
GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_vehiculos_con_clientes" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict 7PHhNTrHZ2qWJDRoZvmhtpveRTQ1tVgU7RVzPblxHTZCXP6qWYufzHgHNRZa4vI

RESET ALL;
