import { isValidISODateTimeWithTimezone } from "@/lib/fechas";
import type { DashboardRange } from "./types";

/** Largo máximo de un período del dashboard (3 años). */
export const MAX_PERIODO_DIAS = 1096;

const DAY_MS = 86_400_000;

export type ParsedDashboardRange =
  | { ok: true; range: Partial<DashboardRange> }
  | { ok: false; error: string };

/**
 * Valida los parámetros `from`/`to` de las rutas del dashboard: timestamps ISO con zona horaria,
 * `from` anterior a `to` y un largo de hasta MAX_PERIODO_DIAS. Con `required` ambos son obligatorios.
 */
export function parseDashboardRange(
  params: URLSearchParams,
  { required = false }: { required?: boolean } = {},
): ParsedDashboardRange {
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;

  if (required && (!from || !to)) {
    return { ok: false, error: "Los parámetros from y to son obligatorios" };
  }
  if ((from && !isValidISODateTimeWithTimezone(from)) || (to && !isValidISODateTimeWithTimezone(to))) {
    return { ok: false, error: "from y to deben ser fechas ISO con zona horaria" };
  }
  if (from && to) {
    const span = Date.parse(to) - Date.parse(from);
    if (span <= 0) return { ok: false, error: "from debe ser anterior a to" };
    if (span > MAX_PERIODO_DIAS * DAY_MS) {
      return { ok: false, error: `El período no puede superar los ${MAX_PERIODO_DIAS} días` };
    }
  }
  return { ok: true, range: { from, to } };
}
