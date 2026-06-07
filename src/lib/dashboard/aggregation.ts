export type Granularity = "day" | "week";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
    day: "Diario",
    week: "Semanal",
};

/**
 * Re-agrupa datos diarios (label="DD") según la granularidad pedida.
 *
 * @param data    Array de puntos diarios con { label: "DD", ...valores numéricos }
 * @param granularity  "day" | "week"
 * @param periodFrom   ISO string del inicio del período (e.g. "2026-05-01T00:00:00.000Z")
 * @param merge        Función que recibe (label, items) y devuelve un ítem sumado
 */
export function applyGranularity<T extends { label: string }>(
    data: T[],
    granularity: Granularity,
    periodFrom: string,
    merge: (label: string, items: T[]) => T,
): T[] {
    if (!data.length) return data;
    if (granularity === "day") return data;
    return groupByCalendarWeek(data, periodFrom, merge);
}

function groupByCalendarWeek<T extends { label: string }>(
    data: T[],
    periodFrom: string,
    merge: (label: string, items: T[]) => T,
): T[] {
    const from = new Date(periodFrom);

    // Mapear cada punto al lunes de su semana ISO
    type Bucket = { weekStart: Date; label: string; items: T[] };
    const buckets = new Map<string, Bucket>();

    for (const item of data) {
        const day = parseInt(item.label, 10);
        if (isNaN(day)) continue;

        const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day));

        // Lunes de la semana ISO
        const dow = date.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
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
