import { APP_LOCALE } from "@/lib/format";

/**
 * Valida si una cadena de texto representa una fecha válida en formato ISO (YYYY-MM-DD)
 * @param dateString - La cadena a validar
 * @returns true si es una fecha válida, false en caso contrario
 */
export const isValidDate = (dateString: string): boolean => {
  if (!dateString || dateString.trim().length === 0) return false;
  const date = new Date(dateString);
  return (
    !isNaN(date.getTime()) && dateString === date.toISOString().split("T")[0]
  );
};

/**
 * Convierte una fecha en formato ISO completo (con hora y timezone) al formato yyyy-MM-dd
 * requerido por inputs HTML de tipo date, respetando el timezone local
 * @param dateString - La cadena de fecha en formato ISO (ej: "2025-11-17T00:00:00+00:00")
 * @returns La fecha en formato yyyy-MM-dd (ej: "2025-11-17"), o string vacío si no hay fecha
 */
export const toDateInputFormat = (dateString: string | undefined): string => {
  if (!dateString) return "";

  // Crear objeto Date desde el string ISO
  const date = new Date(dateString);

  // Obtener año, mes y día en el timezone local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Formatea una fecha a DD/MM/YYYY (usado en UI), intentando normalizar strings con espacio.
 * Mantiene el comportamiento previo usado en ArregloItem y useArreglosFilters.
 */
export function formatDateLabel(dateString: string): string {
  if (!dateString) return "";
  const normalized = dateString.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const base = dateString.slice(0, 10);
    const [y, m, da] = base.split("-");
    if (y && m && da) return `${da}/${m}/${y}`;
    return base;
  }
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
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


