# Shared Utilities & Formatters Instructions

This file guides helpers, formatters, and utilities located under `src/lib/`.

## Formats and Formatters

Formatting utilities are centralized in `src/lib/`. Always check and reuse these existing helpers instead of writing custom or inline formatting logic:

- **Currency & Numbers (`@/lib/format`)**:
  - `formatArs(value, options)`: Formats amounts in Argentine Pesos with `$` prefix (e.g., `$1.250,00`).
  - `formatNumberAr(value, options)`: Formats numbers using Argentine locale conventions (thousands dot `.`, decimals comma `,`).
  - `APP_LOCALE`: Locale constant `"es-AR"`.
- **Dates & Times (`@/lib/fechas`)**: All dates and timestamps are shown and converted in GMT-3 (`APP_TIME_ZONE`, America/Argentina/Buenos_Aires), never in UTC or the browser's timezone. A timestamp saved as `2026-10-13T01:30:00Z` is the 12th for the user, not the 13th.
  - `formatDateLabel(date)`: Human-readable `DD/MM/YYYY` label for the GMT-3 calendar day.
  - `formatDateTimeLabel(date)`: Formatted date and time in GMT-3.
  - `toAppCalendarDate(value)` / `toDateInputFormat(value)`: GMT-3 calendar day (`YYYY-MM-DD`) of a date or timestamp, e.g. to fill a date input when editing.
  - `toISODateAppTimeZone(date)`: Today's (or the given instant's) `YYYY-MM-DD` in GMT-3; use it for "today" defaults.
  - `toISODateTimeWithCurrentTime(date)`: Combines a chosen `YYYY-MM-DD` with the current GMT-3 time to send a timestamp.
  - `formatTimeAgo(date)`: Relative elapsed time (e.g., "hace 5 minutos").
  - `toISODateLocal(date)`: Formats a Date to `YYYY-MM-DD` in the browser's timezone (only for calendar grids built from `Date` objects).
  - `validateDateRangeFilters(filters)`: Validates chronology and syntax for `{ fecha?, from?, to?, desde?, hasta? }`.
  - `resolveDateRangeBounds(filters)`: Converts `{ fecha? }` (single GMT-3 day) or `{ from?, to? }` into `{ from, to }` ISO timestamps.
- **Pagination (`@/lib/pagination`)**:
  - `normalizePagination(params, options)`: Returns safe `{ page, pageSize }` from route or query inputs.
  - `normalizePage(page, defaultPage)`: Returns safe integer page (>= 1).
  - `normalizePageSize(pageSize, defaultSize, maxSize, minSize)`: Normalizes and caps pageSize safely.
  - `calculatePaginationRange(page, pageSize)`: Calculates `{ offset, from, to }` for Supabase `.range(from, to)` calls.
  - `buildPaginationMeta(page, pageSize, total)`: Standard response pagination metadata (`{ page, pageSize, total, totalPages }`).
  - `sliceWithHasMore(rows, limit)`: Infinite scroll sentinel slicer.
- **Vehicles & License Plates (`@/lib/vehiculos`)**:
  - `formatPatente(patente)`: Formats Argentine license plates.
  - `formatPatenteConMarcaYModelo(vehiculo)`: Formats license plate alongside brand and model.
- **Phone Numbers (`@/lib/telefono`)**:
  - `formatTelephoneNumber(codigo_pais, number)`: Formats telephone numbers with country code.

## Logging

`src/lib/logger.ts` is the only place in the entire repository that may write directly to `console.*`. Do not log credentials, certificates, private keys, tokens, or unnecessary personal data.
