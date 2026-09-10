# Project Instructions

## Logging

Do not use `console.log`, `console.info`, `console.warn`, `console.error`, or
`console.debug` directly in application code. Use the project logger from
`@/lib/logger` instead:

```ts
import { logger } from "@/lib/logger";

logger.error("Contexto de la falla", error);
```

`src/lib/logger.ts` is the only place that may write to `console.*`. Do not log
credentials, certificates, private keys, tokens, or unnecessary personal data.

## Supabase Data API Grants

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
