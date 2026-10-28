# Project Instructions

## Parallel Work: Use Git Worktrees

Several agent threads may work on this repository at the same time. Never implement or fix an issue directly in the main checkout (`b2car-app`, usually on `dev`): file changes, test runs, and git commands there affect every other thread.

Before modifying files for an issue (IMPLEMENT or FIX, or any multi-file code change):

1. Create a dedicated worktree and branch from `dev`, or reuse the issue's worktree if it already exists:

   ```sh
   git worktree add ../worktrees/b2car-app/<ISSUE_ID> -b agent/<ISSUE_ID>-<short-slug> dev
   ```

2. Edit, test, lint, and typecheck only inside that worktree.
3. Git-ignored files are not present in a new worktree: copy `.env` from the main checkout and run `npm install` before validating.
4. Plans and work artifacts stay in the main checkout's `.codex-work/<ISSUE_ID>/` (git-ignored and shared between threads). Read and write them there using the main checkout's absolute path.

PLAN may run in the main checkout because it only writes to `.codex-work/`. REVIEW must read the code and diff from the issue's worktree.

Outside your own worktree, do not run `git add .`, `git commit -a`, `git stash`, `git checkout -- <path>`, `git reset`, `git clean`, or switch branches: these capture or discard another thread's work. Inside your worktree, stage only the files you changed.

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

### Schema changes go in migrations only

`supabase/schemas/` is read-only for agents. It is regenerated from the database with Supabase commands, so never create, edit, or delete files there, and do not try to keep it in sync by hand after writing a migration.

Every database change (tables, columns, functions, policies, grants, data backfills) must be written as a migration in `supabase/migrations/`. If a schema file looks outdated or inconsistent with the migrations, leave it as is: it is fixed by regenerating the schema, not by editing it.
