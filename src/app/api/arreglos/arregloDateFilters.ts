import {
  isValidISODateTimeWithTimezone,
  isValidDate,
  utcCalendarDateRangeISO,
} from "@/lib/fechas";

export type ArregloDateRange = { from?: string; to?: string };
export type ArregloDateRangeResult =
  | { ok: true; range: ArregloDateRange }
  | { ok: false; error: string };

/**
 * `from` and `to` are explicit instants with an exclusive upper bound.
 * Older consumers may still send calendar dates in fecha_desde/fecha_hasta;
 * those are interpreted as complete UTC days because their local zone is unknown.
 */
export function parseArregloDateRange(params: URLSearchParams): ArregloDateRangeResult {
  const from = params.get("from")?.trim() || undefined;
  const to = params.get("to")?.trim() || undefined;
  const legacyFrom = params.get("fecha_desde")?.trim() || undefined;
  const legacyTo = params.get("fecha_hasta")?.trim() || undefined;
  const hasExplicit = Boolean(from || to);
  const hasLegacy = Boolean(legacyFrom || legacyTo);

  if (hasExplicit && hasLegacy) {
    return { ok: false, error: "Usá from/to o fecha_desde/fecha_hasta, no ambos formatos." };
  }

  if (hasExplicit) {
    if ((from && !isValidISODateTimeWithTimezone(from)) || (to && !isValidISODateTimeWithTimezone(to))) {
      return { ok: false, error: "Los límites from y to deben ser fechas ISO completas con zona horaria." };
    }
    if (from && to && Date.parse(from) >= Date.parse(to)) {
      return { ok: false, error: "El límite from debe ser anterior a to." };
    }
    return { ok: true, range: { from, to } };
  }

  if ((legacyFrom && !isValidDate(legacyFrom)) || (legacyTo && !isValidDate(legacyTo))) {
    return { ok: false, error: "fecha_desde y fecha_hasta deben tener formato YYYY-MM-DD válido." };
  }
  const range = utcCalendarDateRangeISO(legacyFrom, legacyTo);
  if (!range) return { ok: false, error: "fecha_desde debe ser anterior o igual a fecha_hasta." };
  return { ok: true, range };
}
