COMMENT ON SCHEMA "public" IS 'standard public schema';

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";

GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";

GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON SCHEMA "public" FROM "supabase_auth_admin";

GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";
