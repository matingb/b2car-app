# Supabase & Database Instructions

This file guides database schema inspection, migrations, and grants located under `supabase/`.

## Database Context

To understand the database structure (tables, columns, types, views, functions, policies, grants), do not read `supabase/migrations/`. Migrations are an incremental history, so reconstructing the current state from them is slow and error-prone.

Use the Supabase declarative schema in `supabase/schemas/` instead, which reflects the current state of the database:

- `supabase/schemas/public/tables/`: tables
- `supabase/schemas/public/functions/`: functions
- `supabase/schemas/public/views/`: views
- `supabase/schemas/public/types/`: enums and custom types
- `supabase/schemas/storage/`: storage objects

Only open a migration when you need to know the history of a specific change (for example, when writing a new migration that must stay consistent with a previous one).

### Schema changes go in migrations only

`supabase/schemas/` is read-only for agents. It is regenerated from the database with Supabase commands, so never create, edit, or delete files there, and do not try to keep it in sync by hand after writing a migration.

Every database change (tables, columns, functions, policies, grants, data backfills) must be written as a migration in `supabase/migrations/`. If a schema file looks outdated or inconsistent with the migrations, leave it as is: it is fixed by regenerating the schema, not by editing it.

## Data API Grants & Row Level Security (RLS)

When creating a table in the `public` schema, add explicit grants in the same migration so Supabase Data API clients (`supabase-js`, PostgREST, and GraphQL) can access it.

Do not rely only on inherited/default privileges for new tables. Supabase changed new-project behavior so `public` tables are not exposed to the Data API unless roles are granted access explicitly.

Use the narrowest privileges that match the table's intended API surface. For authenticated app tables, the usual baseline is:

```sql
grant select, insert, update, delete
  on public.your_table
  to authenticated;

grant select, insert, update, delete
  on public.your_table
  to service_role;
```

Only grant `anon` access when unauthenticated clients genuinely need it:

```sql
grant select
  on public.your_table
  to anon;
```

Always enable RLS and add policies for exposed tables. Grants allow the Data API to reach the table; RLS policies decide which rows and operations are actually permitted.
