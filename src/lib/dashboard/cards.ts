import { applyGranularity, type Bucket, type Granularity } from "./aggregation";
import type { PeriodoTotals } from "./totals";
import type { DashboardPeriodo } from "./types";

export type ActiveCard = "arreglos" | "facturacion" | "gastos" | "balance";

export const ACTIVE_CARDS: ActiveCard[] = ["arreglos", "facturacion", "gastos", "balance"];

export type ArreglosBucket = Bucket<{ cantidad: number }>;
export type IngresosBucket = Bucket<{ mano_de_obra: number; repuestos: number; ventas: number }>;
export type GastosBucket = Bucket<{ repuestos: number; sueldos: number; eventuales: number }>;
export type BalanceBucket = Bucket<{ ingresos: number; gastos: number }>;

export type CardBuckets = {
    arreglos: ArreglosBucket[];
    facturacion: IngresosBucket[];
    gastos: GastosBucket[];
    balance: BalanceBucket[];
};

const sum = <T>(items: T[], value: (item: T) => number) =>
    items.reduce((total, item) => total + value(item), 0);

/** Serie del gráfico de una card para un período, agrupada según la granularidad elegida. */
export function buildCardBuckets<C extends ActiveCard>(
    card: C,
    periodo: DashboardPeriodo,
    granularity: Granularity,
): CardBuckets[C] {
    const { series } = periodo;
    switch (card) {
        case "arreglos":
            return applyGranularity(series.arreglos, granularity, (items) => ({
                cantidad: sum(items, (d) => d.cantidad),
            })) as CardBuckets[C];
        case "facturacion":
            return applyGranularity(series.ingresos, granularity, (items) => ({
                mano_de_obra: sum(items, (d) => d.mano_de_obra),
                repuestos: sum(items, (d) => d.repuestos),
                ventas: sum(items, (d) => d.ventas),
            })) as CardBuckets[C];
        case "gastos":
            return applyGranularity(series.gastos, granularity, (items) => ({
                repuestos: sum(items, (d) => d.repuestos),
                sueldos: sum(items, (d) => d.sueldos),
                eventuales: sum(items, (d) => d.eventuales),
            })) as CardBuckets[C];
        default: {
            // Ambas series salen de los mismos días del período; se cruzan por fecha.
            const ingresosPorFecha = new Map(
                series.ingresos.map((d) => [d.fecha, d.mano_de_obra + d.repuestos + d.ventas]),
            );
            const gastosPorFecha = new Map(
                series.gastos.map((d) => [d.fecha, d.repuestos + d.sueldos + d.eventuales]),
            );
            const fechas = new Set([...ingresosPorFecha.keys(), ...gastosPorFecha.keys()]);
            const diaria = Array.from(fechas, (fecha) => ({
                fecha,
                ingresos: ingresosPorFecha.get(fecha) ?? 0,
                gastos: gastosPorFecha.get(fecha) ?? 0,
            }));
            return applyGranularity(diaria, granularity, (items) => ({
                ingresos: sum(items, (d) => d.ingresos),
                gastos: sum(items, (d) => d.gastos),
            })) as CardBuckets[C];
        }
    }
}

export type ValueFormat = "number" | "currency";

/** Cómo se muestra cada card en el gráfico de comparación (un total por bucket, desglose en el tooltip). */
export type CardChartConfig = {
    totalLabel: string;
    valueFormat: ValueFormat;
    parts: Array<{ key: string; label: string }>;
    total: (bucket: Record<string, number>) => number;
};

export const CARD_CHART: Record<ActiveCard, CardChartConfig> = {
    arreglos: {
        totalLabel: "Arreglos",
        valueFormat: "number",
        parts: [],
        total: (b) => b.cantidad ?? 0,
    },
    facturacion: {
        totalLabel: "Facturación",
        valueFormat: "currency",
        parts: [
            { key: "mano_de_obra", label: "Mano de obra" },
            { key: "repuestos", label: "Repuestos" },
            { key: "ventas", label: "Ventas" },
        ],
        total: (b) => (b.mano_de_obra ?? 0) + (b.repuestos ?? 0) + (b.ventas ?? 0),
    },
    gastos: {
        totalLabel: "Gastos",
        valueFormat: "currency",
        parts: [
            { key: "repuestos", label: "Repuestos" },
            { key: "sueldos", label: "Sueldos" },
            { key: "eventuales", label: "Gastos eventuales" },
        ],
        total: (b) => (b.repuestos ?? 0) + (b.sueldos ?? 0) + (b.eventuales ?? 0),
    },
    balance: {
        totalLabel: "Balance",
        valueFormat: "currency",
        parts: [
            { key: "ingresos", label: "Facturación" },
            { key: "gastos", label: "Gastos" },
        ],
        total: (b) => (b.ingresos ?? 0) - (b.gastos ?? 0),
    },
};

/** Si una suba del valor es buena, mala o ninguna de las dos (define el color del Δ%). */
export type Sentiment = "positive" | "negative" | "neutral";

export type ComparisonColumn = {
    key: keyof PeriodoTotals;
    label: string;
    format: ValueFormat | "percent";
    sentiment: Sentiment;
};

/** Columnas de la tabla de comparación de cada card; las filas (períodos) son compartidas. */
export const COMPARISON_COLUMNS: Record<ActiveCard, ComparisonColumn[]> = {
    arreglos: [
        { key: "arreglos", label: "Cantidad", format: "number", sentiment: "positive" },
        { key: "cobrados", label: "Cobrados", format: "number", sentiment: "positive" },
        { key: "parciales", label: "Parciales", format: "number", sentiment: "neutral" },
        { key: "pendientes", label: "Sin cobrar", format: "number", sentiment: "negative" },
        { key: "porCobrar", label: "Por cobrar", format: "currency", sentiment: "negative" },
    ],
    facturacion: [
        { key: "facturacion", label: "Total", format: "currency", sentiment: "positive" },
        { key: "manoDeObra", label: "Mano de obra", format: "currency", sentiment: "positive" },
        { key: "repuestos", label: "Repuestos", format: "currency", sentiment: "positive" },
        { key: "ventas", label: "Ventas", format: "currency", sentiment: "positive" },
    ],
    gastos: [
        { key: "gastos", label: "Total", format: "currency", sentiment: "negative" },
        { key: "gastoRepuestos", label: "Repuestos", format: "currency", sentiment: "negative" },
        { key: "sueldos", label: "Sueldos", format: "currency", sentiment: "negative" },
        { key: "eventuales", label: "Eventuales", format: "currency", sentiment: "negative" },
    ],
    balance: [
        { key: "facturacion", label: "Facturación", format: "currency", sentiment: "positive" },
        { key: "gastos", label: "Gastos", format: "currency", sentiment: "negative" },
        { key: "balance", label: "Balance", format: "currency", sentiment: "positive" },
        { key: "margen", label: "Margen", format: "percent", sentiment: "positive" },
    ],
};

/**
 * Variación contra la fila base: relativa (fracción) para importes y cantidades, en puntos
 * porcentuales para porcentajes. null si no hay base o si la base es 0 en una variación relativa.
 */
export function computeDelta(
    value: number | null,
    base: number | null,
    format: ComparisonColumn["format"],
): number | null {
    if (value === null || base === null) return null;
    if (format === "percent") return (value - base) * 100;
    if (base === 0) return null;
    return (value - base) / Math.abs(base);
}
