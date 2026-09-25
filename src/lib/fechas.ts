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

function localMidnight({ year, month, day }: CalendarDateParts): Date {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
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

export type CalendarDateParts = { year: number; month: number; day: number };

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

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `${dateInput}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
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
 * Convierte una fecha en formato ISO completo (con hora y timezone) al formato yyyy-MM-dd
 * requerido por inputs HTML de tipo date, respetando el timezone local
 * @param dateString - La cadena de fecha en formato ISO (ej: "2025-11-17T00:00:00+00:00")
 * @returns La fecha en formato yyyy-MM-dd (ej: "2025-11-17"), o string vacío si no hay fecha
 */
export const toDateInputFormat = (dateString: string | undefined): string => {
  if (!dateString) return "";

  const calendarDateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (calendarDateMatch) return calendarDateMatch[0];

  // Crear objeto Date desde el string ISO
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  // Obtener año, mes y día en el timezone local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/** Convert a timestamp to the browser's displayed calendar day for editing. */
export function toLocalDateInputFormat(dateString: string | undefined): string {
  if (!dateString) return "";
  if (parseCalendarDate(dateString)) return dateString;
  const date = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : toISODateLocal(date);
}

/**
 * Formatea una fecha a DD/MM/YYYY (usado en UI), intentando normalizar strings con espacio.
 * Mantiene el comportamiento previo usado en ArregloItem y useArreglosFilters.
 */
export function formatDateLabel(
  dateString: string | null | undefined,
  fallback = ""
): string {
  if (!dateString) return fallback;
  const normalized = dateString.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const base = dateString.slice(0, 10);
    const [y, m, da] = base.split("-");
    if (y && m && da) return `${da}/${m}/${y}`;
    return base || fallback;
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(d);
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

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm (usado en UI), intentando normalizar strings con espacio.
 * Mantiene el comportamiento previo usado en TurnoItem.
 */
export function formatDateTimeLabel(
  dateString: string | null | undefined,
  fallback = ""
): string {
  if (!dateString) return fallback;
  const normalized = dateString.replace(" ", "T");
  const d = new Date(normalized);
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


