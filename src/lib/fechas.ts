import { APP_LOCALE } from "@/lib/format";

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/**
 * Convierte una Date al formato YYYY-MM-DD respetando el timezone local.
 * Útil para comparar/filtrar turnos por día e inicializar inputs type="date".
 */
export function toISODateLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export type CalendarDateParts = { year: number; month: number; day: number };

export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Parse and validate a YYYY-MM-DD calendar date without interpreting it as UTC. */
export function parseCalendarDate(value: string): CalendarDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    return null;
  }
  return { year, month, day };
}

const ISO_DATE_TIME_WITH_ZONE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/** Validate a complete ISO date-time that explicitly includes its UTC offset. */
export function isValidISODateTimeWithTimezone(value: string): boolean {
  const match = ISO_DATE_TIME_WITH_ZONE.exec(value);
  if (!match || !parseCalendarDate(match[1])) return false;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[6] !== "Z") {
    const offsetHour = Number(match[8]);
    const offsetMinute = Number(match[9]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

/** Turn legacy date-only API bounds into complete UTC days. */
export function utcCalendarDateRangeISO(from?: string, through?: string): {
  from: string | undefined;
  to: string | undefined;
} | null {
  const fromParts = from ? parseCalendarDate(from) : null;
  const throughParts = through ? parseCalendarDate(through) : null;
  if ((from && !fromParts) || (through && !throughParts)) return null;

  const start = fromParts ? `${from}T00:00:00.000Z` : undefined;
  let end: string | undefined;
  if (throughParts) {
    const date = new Date(0);
    date.setUTCFullYear(throughParts.year, throughParts.month - 1, throughParts.day + 1);
    date.setUTCHours(0, 0, 0, 0);
    end = date.toISOString();
  }
  if (start && end && Date.parse(start) >= Date.parse(end)) return null;
  return { from: start ?? undefined, to: end ?? undefined };
}

function localMidnight({ year, month, day }: CalendarDateParts): Date {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function zonedCalendarDateTimeISO(
  date: CalendarDateParts,
  time: Pick<ReturnType<typeof getTimeZoneParts>, "hour" | "minute" | "second"> & { millisecond?: number },
  timeZone: string,
): string {
  const wallClockAsUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
    time.millisecond ?? 0,
  );
  const guessedLocal = getTimeZoneParts(new Date(wallClockAsUtc), timeZone);
  const guessedLocalAsUtc = Date.UTC(
    guessedLocal.year,
    guessedLocal.month - 1,
    guessedLocal.day,
    guessedLocal.hour,
    guessedLocal.minute,
    guessedLocal.second,
    time.millisecond ?? 0,
  );
  const timeZoneOffset = guessedLocalAsUtc - wallClockAsUtc;
  return new Date(wallClockAsUtc - timeZoneOffset).toISOString();
}

/** Calendar date (YYYY-MM-DD) of an instant in the application time zone. */
export function toISODateAppTimeZone(date: Date = new Date()): string {
  const { year, month, day } = getTimeZoneParts(date, APP_TIME_ZONE);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convert an application calendar date to an exclusive Buenos Aires day range. */
export function argentinaCalendarDateRangeISO(from?: string, through?: string): {
  from: string | undefined;
  to: string | undefined;
} | null {
  const fromParts = from ? parseCalendarDate(from) : null;
  const throughParts = through ? parseCalendarDate(through) : null;
  if ((from && !fromParts) || (through && !throughParts)) return null;

  const start = fromParts
    ? zonedCalendarDateTimeISO(fromParts, { hour: 0, minute: 0, second: 0 }, APP_TIME_ZONE)
    : undefined;
  let end: string | undefined;
  if (throughParts) {
    const nextDay = new Date(Date.UTC(throughParts.year, throughParts.month - 1, throughParts.day + 1));
    end = zonedCalendarDateTimeISO(
      {
        year: nextDay.getUTCFullYear(),
        month: nextDay.getUTCMonth() + 1,
        day: nextDay.getUTCDate(),
      },
      { hour: 0, minute: 0, second: 0 },
      APP_TIME_ZONE,
    );
  }
  if (start && end && Date.parse(start) >= Date.parse(end)) return null;
  return { from: start, to: end };
}

/** Convert a calendar date to its local midnight as an ISO timestamp. */
export function localCalendarDateStartISO(value: string): string | null {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  return localMidnight(parts).toISOString();
}

/** Convert a calendar date to the following local midnight as an exclusive bound. */
export function localCalendarDateEndExclusiveISO(value: string): string | null {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  const date = localMidnight(parts);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

/** Build local timestamp bounds for an optional, inclusive calendar date range. */
export function localCalendarDateRangeISO(from?: string, through?: string): {
  from: string | undefined;
  to: string | undefined;
} | null {
  const start = from ? localCalendarDateStartISO(from) : undefined;
  const end = through ? localCalendarDateEndExclusiveISO(through) : undefined;
  if ((from && !start) || (through && !end)) return null;
  if (start && end && Date.parse(start) >= Date.parse(end)) return null;
  return { from: start ?? undefined, to: end ?? undefined };
}

/** Keep a selected calendar day and combine it with the current local clock time. */
export function toISODateTimeWithLocalCurrentTime(
  dateInput: string,
  now: Date = new Date(),
): string | null {
  const parts = parseCalendarDate(dateInput);
  if (!parts || Number.isNaN(now.getTime())) return null;
  const date = localMidnight(parts);
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return date.toISOString();
}

/**
 * Completa una fecha de calendario (YYYY-MM-DD) con la hora local actual para
 * enviarla como timestamp. Si el valor ya es un timestamp completo o un objeto Date,
 * lo devuelve en formato ISO sin modificar (comportamiento idempotente).
 */
export function toISODateTimeWithCurrentTime(
  dateInput: string | Date,
  now: Date = new Date()
): string {
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? now.toISOString() : dateInput.toISOString();
  }
  if (typeof dateInput !== "string" || !isValidDate(dateInput)) return String(dateInput);

  const timeZoneParts = getTimeZoneParts(now, APP_TIME_ZONE);
  const date = parseCalendarDate(dateInput)!;
  return zonedCalendarDateTimeISO(
    date,
    { ...timeZoneParts, millisecond: now.getMilliseconds() },
    APP_TIME_ZONE,
  );
}

export function horaAMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function isSameLocalDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Dom..Sáb)
  const offset = (day + 6) % 7; // 0..6 (Lun..Dom)
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(date: Date) {
  const start = startOfWeekMonday(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthGrid(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);

  // lunes=0..domingo=6
  const firstOffset = (first.getDay() + 6) % 7;
  const days: Array<Date | null> = [];
  for (let i = 0; i < firstOffset; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
  return days;
}

/**
 * Valida si una cadena de texto representa una fecha válida en formato ISO (YYYY-MM-DD)
 * @param dateString - La cadena a validar
 * @returns true si es una fecha válida, false en caso contrario
 */
export const isValidDate = (dateString: string): boolean => {
  return parseCalendarDate(dateString) !== null;
};

/**
 * Registros viejos guardaron fechas sin hora (YYYY-MM-DD) que la base convirtió a medianoche UTC.
 * Esos valores representan un día de calendario, no un instante: convertirlos a GMT-3 los
 * mostraría un día antes.
 */
const UTC_MIDNIGHT_DATE_ONLY = /^(\d{4}-\d{2}-\d{2})[T ]00:00(?::00(?:\.0+)?)?(?:Z|\+00(?::?00)?)$/;

/**
 * Normaliza un timestamp para que `Date` pueda parsearlo: separa fecha y hora con "T" y
 * completa los offsets cortos que devuelve Postgres (ej: "+00" -> "+00:00").
 */
function normalizeTimestamp(value: string): string {
  return value
    .trim()
    .replace(" ", "T")
    .replace(/(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?[+-]\d{2})$/, "$1:00");
}

/**
 * Día calendario (YYYY-MM-DD) que una fecha o timestamp representa para la app, siempre en
 * GMT-3 (America/Argentina/Buenos_Aires), sin depender de la zona horaria del navegador:
 * - "YYYY-MM-DD" se devuelve tal cual.
 * - Un timestamp con hora se convierte a Buenos Aires (21:30 del 12/10 es el 12/10 aunque en
 *   UTC ya sea el 13/10). Si no trae zona horaria se interpreta como hora de Buenos Aires.
 * - Excepción: los registros viejos guardados sin hora (medianoche UTC exacta) conservan su día.
 * Devuelve null si el valor no es una fecha válida.
 */
export function toAppCalendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (parseCalendarDate(value)) return value;

  const legacy = UTC_MIDNIGHT_DATE_ONLY.exec(value.trim());
  if (legacy && parseCalendarDate(legacy[1])) return legacy[1];

  const date = parseDateInAppTimeZone(value);
  return Number.isNaN(date.getTime()) ? null : toISODateAppTimeZone(date);
}

/**
 * Convierte una fecha en formato ISO completo (con hora y timezone) al formato yyyy-MM-dd
 * requerido por inputs HTML de tipo date, usando el día calendario en GMT-3.
 * @param dateString - La cadena de fecha en formato ISO (ej: "2025-11-17T00:00:00+00:00")
 * @returns La fecha en formato yyyy-MM-dd (ej: "2025-11-17"), o string vacío si no hay fecha
 */
export const toDateInputFormat = (dateString: string | undefined): string =>
  toAppCalendarDate(dateString) ?? "";

/** Convert a timestamp to the browser's displayed calendar day for editing. */
export function toLocalDateInputFormat(dateString: string | undefined): string {
  if (!dateString) return "";
  if (parseCalendarDate(dateString)) return dateString;
  const date = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : toISODateLocal(date);
}

/**
 * Formatea una fecha a DD/MM/YYYY (usado en UI) con el día calendario en GMT-3
 * (ver `toAppCalendarDate`), intentando normalizar strings con espacio.
 */
export function formatDateLabel(
  dateString: string | null | undefined,
  fallback = ""
): string {
  if (!dateString) return fallback;
  const calendarDate = toAppCalendarDate(dateString);
  if (calendarDate) return formatCalendarDateLabel(calendarDate, fallback);

  const base = dateString.slice(0, 10);
  const [y, m, da] = base.split("-");
  if (y && m && da) return `${da}/${m}/${y}`;
  return base || fallback;
}
/** Format a timestamptz date in the browser's local timezone. */
export function formatLocalDateLabel(
  dateString: string | null | undefined,
  fallback = "",
): string {
  if (!dateString) return fallback;
  const date = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateInAppTimeZone(dateString: string): Date {
  const normalized = normalizeTimestamp(dateString);
  if (/(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(normalized)) {
    return new Date(normalized);
  }

  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(normalized);
  if (!match) return new Date(normalized);

  const calendarDate = parseCalendarDate(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] ?? 0);
  const millisecond = Number(`${(match[5] ?? "").slice(0, 3).padEnd(3, "0")}`);
  if (!calendarDate || hour > 23 || minute > 59 || second > 59) return new Date(Number.NaN);

  return new Date(
    zonedCalendarDateTimeISO(
      calendarDate,
      { hour, minute, second, millisecond },
      APP_TIME_ZONE,
    ),
  );
}

/** Format a date or timestamp using the application's Buenos Aires timezone. */
export function formatAppDateLabel(
  dateString: string | null | undefined,
  fallback = "",
): string {
  if (!dateString) return fallback;

  if (parseCalendarDate(dateString)) return formatCalendarDateLabel(dateString, fallback);

  const date = parseDateInAppTimeZone(dateString);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Format a date-only YYYY-MM-DD value without converting it into an instant. */
export function formatCalendarDateLabel(
  dateString: string | null | undefined,
  fallback = "",
): string {
  if (!dateString) return fallback;
  const parts = parseCalendarDate(dateString);
  if (!parts) return fallback;
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm (usado en UI) en GMT-3, intentando normalizar strings con espacio.
 * Mantiene el comportamiento previo usado en TurnoItem.
 */
export function formatDateTimeLabel(
  dateString: string | null | undefined,
  fallback = ""
): string {
  if (!dateString) return fallback;
  const d = parseDateInAppTimeZone(dateString);
  if (Number.isNaN(d.getTime())) {
    const base = dateString.slice(0, 10);
    const [y, m, da] = base.split("-");
    const time = dateString.slice(11, 16);
    if (y && m && da) return `${da}/${m}/${y} ${time}`;
    return (base + " " + time).trim() || fallback;
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(d);
}


const rtf = new Intl.RelativeTimeFormat(APP_LOCALE, { numeric: "always" });

function capitalizeFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTimeAgo(
  fecha: string | Date,
  now: Date = new Date()
): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";

  const diffMs = d.getTime() - now.getTime(); // pasado => negativo
  const diffSec = Math.round(diffMs / 1000);

  const abs = Math.abs(diffSec);
  if (abs < 60) return capitalizeFirst(rtf.format(diffSec, "second"));

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return capitalizeFirst(rtf.format(diffMin, "minute"));

  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return capitalizeFirst(rtf.format(diffHr, "hour"));

  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return capitalizeFirst(rtf.format(diffDay, "day"));

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return capitalizeFirst(rtf.format(diffMonth, "month"));

  const diffYear = Math.round(diffMonth / 12);
  return capitalizeFirst(rtf.format(diffYear, "year"));
}

export type DateRangeFilters = {
  fecha?: string | null;
  from?: string | null;
  to?: string | null;
  desde?: string | null;
  hasta?: string | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
};

export type ResolvedDateBounds = {
  from: string | null;
  to: string | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza un valor de inicio a timestamp ISO en Buenos Aires si es solo fecha (YYYY-MM-DD),
 * o conserva el timestamp/cadena intacta si ya incluye hora/zona.
 */
export function toTimestampStart(value: string): string {
  if (!DATE_ONLY_PATTERN.test(value)) return value;
  return argentinaCalendarDateRangeISO(value, value)?.from ?? value;
}

/**
 * Normaliza un valor de fin a timestamp ISO de inicio del día siguiente (exclusivo) en Buenos Aires
 * si es solo fecha (YYYY-MM-DD), o conserva el timestamp/cadena intacta si ya incluye hora/zona.
 */
export function toTimestampEndExclusive(value: string): string {
  if (!DATE_ONLY_PATTERN.test(value)) return value;
  return argentinaCalendarDateRangeISO(value, value)?.to ?? value;
}

/**
 * Valida si una fecha de filtro es una fecha calendario YYYY-MM-DD válida o un ISO instant con timezone.
 */
export function isValidFilterDate(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value)
    ? isValidDate(value)
    : isValidISODateTimeWithTimezone(value);
}

/**
 * Valida la sintaxis y coherencia cronológica de los filtros de fecha.
 * Admite tanto un día puntual (`fecha`) como un rango (`from`/`to`, `desde`/`hasta`, `fecha_desde`/`fecha_hasta`).
 */
export function validateDateRangeFilters(filters: DateRangeFilters): string | null {
  const from = filters.from || filters.desde || filters.fecha_desde;
  const to = filters.to || filters.hasta || filters.fecha_hasta;
  const hasRange = Boolean(from || to);

  if (filters.fecha && hasRange) {
    return "Usá fecha o from/to, no ambos formatos.";
  }

  if (filters.fecha && !isValidDate(filters.fecha)) {
    return "fecha debe tener formato YYYY-MM-DD válido.";
  }

  if (from && !isValidFilterDate(from)) {
    return "from debe ser una fecha válida con zona horaria o YYYY-MM-DD.";
  }

  if (to && !isValidFilterDate(to)) {
    return "to debe ser una fecha válida con zona horaria o YYYY-MM-DD.";
  }

  if (from && to && Date.parse(toTimestampStart(from)) >= Date.parse(toTimestampEndExclusive(to))) {
    return "from debe ser anterior a to.";
  }

  return null;
}

/**
 * Resuelve los límites inferior y superior inclusivo/exclusivo en el huso de Buenos Aires (GMT-3).
 * Si se especifica `fecha`, resuelve el día completo [inicio, inicioDelDíaSiguiente).
 * Si se especifica un rango, normaliza cada extremo manteniendo límites abiertos (`null`) si no se envían.
 */
export function resolveDateRangeBounds(filters: DateRangeFilters): ResolvedDateBounds {
  if (filters.fecha) {
    return {
      from: toTimestampStart(filters.fecha),
      to: toTimestampEndExclusive(filters.fecha),
    };
  }

  const from = filters.from || filters.desde || filters.fecha_desde;
  const to = filters.to || filters.hasta || filters.fecha_hasta;

  return {
    from: from ? toTimestampStart(from) : null,
    to: to ? toTimestampEndExclusive(to) : null,
  };
}



