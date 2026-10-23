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

/** Punto agrupado: `key` es el primer día del bucket (YYYY-MM-DD), ordenable como texto. */
export type Bucket<V> = V & { key: string; label: string };

/**
 * Agrupa una serie diaria ({ fecha: "YYYY-MM-DD" }) por día, semana calendario (lunes a domingo) o
 * mes calendario, en orden cronológico. Las semanas y meses que el período corta solo suman los días
 * incluidos; la etiqueta sigue siendo la de la semana o el mes completo.
 *
 * @param merge Recibe los días de un bucket y devuelve sus valores sumados.
 */
export function applyGranularity<T extends { fecha: string }, V extends object>(
    data: T[],
    granularity: Granularity,
    merge: (items: T[]) => V,
): Array<Bucket<V>> {
    const buckets = new Map<string, { label: string; items: T[] }>();

    for (const item of data) {
        const date = parseFecha(item.fecha);
        if (!date) continue;

        const { key, label } = bucketOf(date, granularity);
        const bucket = buckets.get(key);
        if (bucket) bucket.items.push(item);
        else buckets.set(key, { label, items: [item] });
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, { label, items }]) => ({ ...merge(items), key, label }));
}

function parseFecha(fecha: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function bucketOf(date: Date, granularity: Granularity): { key: string; label: string } {
    if (granularity === "month") {
        const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        return {
            key: isoDate(start),
            label: `${MONTH_NAMES_SHORT_ES[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
        };
    }
    if (granularity === "week") {
        const toMonday = (date.getUTCDay() + 6) % 7;
        const monday = new Date(date.getTime() - toMonday * 86_400_000);
        const sunday = new Date(monday.getTime() + 6 * 86_400_000);
        return { key: isoDate(monday), label: `${dayMonth(monday)} - ${dayMonth(sunday)}` };
    }
    return { key: isoDate(date), label: dayMonth(date) };
}

function isoDate(date: Date): string {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dayMonth(date: Date): string {
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}
