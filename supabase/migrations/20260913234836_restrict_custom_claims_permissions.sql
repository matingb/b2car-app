-- REVOKE FROM PUBLIC no elimina grants explícitos heredados de anon/authenticated.
REVOKE ALL ON FUNCTION public.custom_claims(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_claims(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.custom_claims(jsonb) TO supabase_auth_admin;
