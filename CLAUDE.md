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

## Database Context (Supabase)

To understand the database structure (tables, columns, types, views, functions, policies, grants), do not read `supabase/migrations/`. Migrations are an incremental history, so reconstructing the current state from them is slow and error-prone.

Use the Supabase declarative schema in `supabase/schemas/` instead, which reflects the current state of the database:

- `supabase/schemas/public/tables/`: tables
- `supabase/schemas/public/functions/`: functions
- `supabase/schemas/public/views/`: views
- `supabase/schemas/public/types/`: enums and custom types
- `supabase/schemas/storage/`: storage objects

Only open a migration when you need to know the history of a specific change (for example, when writing a new migration that must stay consistent with a previous one).
