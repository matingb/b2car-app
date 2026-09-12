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

## UI Components

Reusable UI components are located in `src/app/components/ui/` (import alias: `@/app/components/ui/...`).

Always check this directory before creating new UI elements to maintain visual and functional consistency across the application. Available components include:
- **Inputs & Selection**: `Button`, `IconButton`, `IconInput`, `NumberInput`, `PhoneInput`, `Checkbox`, `Toggle`, `Dropdown`, `DropdownMultiSelect`, `Autocomplete`, `SearchBar`, `FilterChip`
- **Modals & Overlays**: `Modal`, `ModalMessage`, `MenuSheet`, `sheet`
- **Layout & Display**: `Card`, `ScreenHeader`, `ScrollPage`, `Divider`, `DefinitionItem`, `ListSkeleton`, `Avatar`, `Calendar`
- **Domain UI**: `TallerSelector`, `TenantNameText`, `ContactRow`, `WhatsAppIcon`

## Formats and Formatters

Formatting utilities are centralized in `src/lib/`. Always check and reuse these existing helpers instead of writing custom or inline formatting logic:

- **Currency & Numbers (`@/lib/format`)**:
  - `formatArs(value, options)`: Formats amounts in Argentine Pesos with `$` prefix (e.g., `$1.250,00`).
  - `formatNumberAr(value, options)`: Formats numbers using Argentine locale conventions (thousands dot `.`, decimals comma `,`).
  - `APP_LOCALE`: Locale constant `"es-AR"`.
- **Dates & Times (`@/lib/fechas`)**:
  - `formatDateLabel(date)`: Human-readable date label.
  - `formatDateTimeLabel(date)`: Formatted date and time.
  - `formatTimeAgo(date)`: Relative elapsed time (e.g., "hace 5 minutos").
  - `toISODateLocal(date)`: Formats a Date to `YYYY-MM-DD` in the local timezone.
- **Vehicles & License Plates (`@/lib/vehiculos`)**:
  - `formatPatente(patente)`: Formats Argentine license plates.
  - `formatPatenteConMarcaYModelo(vehiculo)`: Formats license plate alongside brand and model.
- **Phone Numbers (`@/lib/telefono`)**:
  - `formatTelephoneNumber(codigo_pais, number)`: Formats telephone numbers with country code.

## Theme

Always use the theme colors defined in `src/app/theme/theme.css`.
Don't use `!important` unless it is really necessary.
