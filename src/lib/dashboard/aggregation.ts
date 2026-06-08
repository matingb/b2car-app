export type Granularity = "day" | "week" | "month";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
    day: "Diario",
    week: "Semanal",
    month: "Mensual",
};

const MONTH_NAMES_SHORT_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/**
 * Re-agrupa datos diarios (label="DD") segun la granularidad pedida.
 *
 * @param data Array de puntos diarios con { label: "DD", ...valores numericos }
 * @param granularity "day" | "week" | "month"
 * @param periodFrom ISO string del inicio del periodo (e.g. "2026-05-01T00:00:00.000Z")
 * @param merge Funcion que recibe (label, items) y devuelve un item sumado
 */
export function applyGranularity<T extends { label: string }>(
    data: T[],
    granularity: Granularity,
    periodFrom: string,
    merge: (label: string, items: T[]) => T,
): T[] {
    if (!data.length) return data;
    if (granularity === "day") return data;
    if (granularity === "month") return groupByMonth(data, periodFrom, merge);
    return groupByCalendarWeek(data, periodFrom, merge);
}

function groupByMonth<T extends { label: string }>(
    data: T[],
    periodFrom: string,
    merge: (label: string, items: T[]) => T,
): T[] {
    const from = new Date(periodFrom);
    const label = `${MONTH_NAMES_SHORT_ES[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
    return [merge(label, data)];
}

function groupByCalendarWeek<T extends { label: string }>(
    data: T[],
    periodFrom: string,
    merge: (label: string, items: T[]) => T,
): T[] {
    const from = new Date(periodFrom);

    type Bucket = { weekStart: Date; label: string; items: T[] };
    const buckets = new Map<string, Bucket>();

    for (const item of data) {
        const day = parseInt(item.label, 10);
        if (isNaN(day)) continue;

        const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day));
        const dow = date.getUTCDay();
        const toMonday = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + toMonday));

        const key = monday.toISOString();

        if (!buckets.has(key)) {
            const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
            const label = `${pad(monday.getUTCDate())}/${pad(monday.getUTCMonth() + 1)} - ${pad(sunday.getUTCDate())}/${pad(sunday.getUTCMonth() + 1)}`;
            buckets.set(key, { weekStart: monday, label, items: [] });
        }

        buckets.get(key)!.items.push(item);
    }

    return Array.from(buckets.values())
        .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
        .map((b) => merge(b.label, b.items));
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}
