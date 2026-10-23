import { MESES, localCalendarDateRangeISO, localCalendarDateStartISO, parseCalendarDate, toISODateLocal } from "@/lib/fechas";
import type { DashboardRange } from "./types";

export type PeriodOption = DashboardRange & { label: string };

export type PeriodTimezone = "local" | "UTC";

/** Mes calendario `month` (0-11) de `year`; acepta meses fuera de rango (-1 = diciembre del año anterior). */
export function buildMonthPeriod(year: number, month: number, timezone: PeriodTimezone = "local"): PeriodOption {
    const d = timezone === "UTC" ? new Date(Date.UTC(year, month, 1)) : new Date(year, month, 1);
    const nextMonth = timezone === "UTC"
        ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
        : new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const from = timezone === "UTC"
        ? d.toISOString()
        : localCalendarDateStartISO(toISODateLocal(d)) ?? d.toISOString();
    const to = timezone === "UTC"
        ? nextMonth.toISOString()
        : localCalendarDateStartISO(toISODateLocal(nextMonth)) ?? nextMonth.toISOString();
    const resolvedYear = timezone === "UTC" ? d.getUTCFullYear() : d.getFullYear();
    const resolvedMonth = timezone === "UTC" ? d.getUTCMonth() : d.getMonth();
    return { label: `${MESES[resolvedMonth]} ${resolvedYear}`, from, to };
}

/** Los últimos `count` meses calendario, del más reciente al más viejo. */
export function buildPeriodOptions(
    count = 12,
    now: Date = new Date(),
    timezone: PeriodTimezone = "local",
): PeriodOption[] {
    const year = timezone === "UTC" ? now.getUTCFullYear() : now.getFullYear();
    const month = timezone === "UTC" ? now.getUTCMonth() : now.getMonth();
    return Array.from({ length: count }, (_, i) => buildMonthPeriod(year, month - i, timezone));
}

function shortDateLabel(value: string): string {
    const parts = parseCalendarDate(value)!;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(parts.day)}/${pad(parts.month)}/${String(parts.year).slice(-2)}`;
}

/** Rango de días calendario inclusivo (`desde` y `hasta` en YYYY-MM-DD); null si es inválido. */
export function buildRangePeriod(desde: string, hasta: string): PeriodOption | null {
    const range = localCalendarDateRangeISO(desde, hasta);
    if (!range?.from || !range.to) return null;
    return { label: `${shortDateLabel(desde)} – ${shortDateLabel(hasta)}`, from: range.from, to: range.to };
}

/** Año y mes (0-11) que representa un período mensual, robusto a bounds en UTC o en hora local. */
export function monthOfPeriod(period: DashboardRange): { year: number; month: number } {
    const mid = new Date((Date.parse(period.from) + Date.parse(period.to)) / 2);
    return { year: mid.getFullYear(), month: mid.getMonth() };
}

export function periodKey(range: DashboardRange): string {
    return `${range.from}|${range.to}`;
}
