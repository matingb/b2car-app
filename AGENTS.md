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

## UI Components

Reusable UI components are located in `src/app/components/ui/` (import alias: `@/app/components/ui/...`).

Always check this directory before creating new UI elements to maintain visual and functional consistency across the application. Available components include:
- **Inputs & Selection**: `Button`, `IconButton`, `IconInput`, `NumberInput`, `PhoneInput`, `Checkbox`, `Toggle`, `Dropdown`, `DropdownMultiSelect`, `Autocomplete`, `SearchBar`, `FilterChip`
- **Modals & Overlays**: `Modal`, `ModalMessage`, `MenuSheet`, `sheet`
- **Layout & Display**: `Card`, `ScreenHeader`, `ScrollPage`, `Divider`, `DefinitionItem`, `ListSkeleton`, `Avatar`, `Calendar`
- **Domain UI**: `TallerSelector`, `TenantNameText`, `ContactRow`, `WhatsAppIcon`

### Client selection

Every editable input that selects an existing client (vehicle owner, turno client, reassignment, etc.) must reuse `ClienteAutocomplete` from `@/app/components/clientes/ClienteAutocomplete`. It searches on the server through `GET /api/clientes` (`searchClientes`), keeps the selected client and resolves IDs outside the loaded list. Do not build client options only from the preloaded `clientes` of `ClientesProvider`: that list is paginated, so clients outside the first page would be unreachable. Use the second argument of its `onChange(clienteId, cliente)` when the form needs the selected client's data (type, name).

This rule does not apply to read-only client fields, client type selectors, fiscal receiver data, or list filters.

## Formats and Formatters

Formatting utilities are centralized in `src/lib/`. Always check and reuse these existing helpers instead of writing custom or inline formatting logic:

- **Currency & Numbers (`@/lib/format`)**:
  - `formatArs(value, options)`: Formats amounts in Argentine Pesos with `$` prefix (e.g., `$1.250,00`).
  - `formatNumberAr(value, options)`: Formats numbers using Argentine locale conventions (thousands dot `.`, decimals comma `,`).
  - `APP_LOCALE`: Locale constant `"es-AR"`.
- **Dates & Times (`@/lib/fechas`)**: all dates and timestamps are shown and converted in GMT-3 (`APP_TIME_ZONE`, America/Argentina/Buenos_Aires), never in UTC or the browser's timezone. A timestamp saved as `2026-10-13T01:30:00Z` is the 12th for the user, not the 13th.
  - `formatDateLabel(date)`: Human-readable `DD/MM/YYYY` label for the GMT-3 calendar day.
  - `formatDateTimeLabel(date)`: Formatted date and time in GMT-3.
  - `toAppCalendarDate(value)` / `toDateInputFormat(value)`: GMT-3 calendar day (`YYYY-MM-DD`) of a date or timestamp, e.g. to fill a date input when editing.
  - `toISODateAppTimeZone(date)`: Today's (or the given instant's) `YYYY-MM-DD` in GMT-3; use it for "today" defaults.
  - `toISODateTimeWithCurrentTime(date)`: Combines a chosen `YYYY-MM-DD` with the current GMT-3 time to send a timestamp.
  - `formatTimeAgo(date)`: Relative elapsed time (e.g., "hace 5 minutos").
  - `toISODateLocal(date)`: Formats a Date to `YYYY-MM-DD` in the browser's timezone (only for calendar grids built from `Date` objects).
- **Vehicles & License Plates (`@/lib/vehiculos`)**:
  - `formatPatente(patente)`: Formats Argentine license plates.
  - `formatPatenteConMarcaYModelo(vehiculo)`: Formats license plate alongside brand and model.
- **Phone Numbers (`@/lib/telefono`)**:
  - `formatTelephoneNumber(codigo_pais, number)`: Formats telephone numbers with country code.

## Theme

Always use the theme colors defined in `src/app/theme/theme.css`.
Don't use `!important` unless it is really necessary.

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
