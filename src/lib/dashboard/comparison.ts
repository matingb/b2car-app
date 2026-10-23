import { buildMonthPeriod, buildRangePeriod, monthOfPeriod, periodKey, type PeriodOption } from "./periods";

/** Períodos que se pueden graficar a la vez. */
export const MAX_VISIBLE_PERIODS = 4;

export const COMPARISON_STORAGE_KEY = "b2car.dashboard.comparacion";

/**
 * Cómo se define un período a comparar. Los relativos se resuelven contra el mes del header, así que
 * siguen teniendo sentido al cambiar de mes o al volver otro día.
 */
export type ComparisonPeriodDef =
    | { kind: "mes-dashboard" }
    | { kind: "mes-anterior" }
    | { kind: "anio-anterior" }
    | { kind: "mes"; year: number; month: number }
    | { kind: "rango"; desde: string; hasta: string };

export type ComparisonRow = {
    id: string;
    def: ComparisonPeriodDef;
    visible: boolean;
    /** Índice en la paleta de períodos; único entre los visibles. */
    colorIndex: number;
};

/**
 * Filas de la tabla en el orden en que se muestran. La primera es la referencia contra la que se
 * calcula el Δ% del resto.
 */
export type ComparisonState = {
    open: boolean;
    rows: ComparisonRow[];
};

export const DASHBOARD_MONTH_ROW_ID = "mes-dashboard";

export const DEFAULT_COMPARISON_STATE: ComparisonState = {
    open: false,
    rows: [{ id: DASHBOARD_MONTH_ROW_ID, def: { kind: "mes-dashboard" }, visible: true, colorIndex: 0 }],
};

export const RELATIVE_PERIOD_LABELS = {
    "mes-dashboard": "Mes del dashboard",
    "mes-anterior": "Mes anterior",
    "anio-anterior": "Mismo mes del año anterior",
} as const;

export function resolveComparisonPeriod(def: ComparisonPeriodDef, base: PeriodOption): PeriodOption | null {
    switch (def.kind) {
        case "mes-dashboard":
            return { label: base.label, from: base.from, to: base.to };
        case "mes-anterior": {
            const { year, month } = monthOfPeriod(base);
            return buildMonthPeriod(year, month - 1);
        }
        case "anio-anterior": {
            const { year, month } = monthOfPeriod(base);
            return buildMonthPeriod(year - 1, month);
        }
        case "mes":
            return buildMonthPeriod(def.year, def.month);
        case "rango":
            return buildRangePeriod(def.desde, def.hasta);
    }
}

/** Aclaración que acompaña al nombre del período en la tabla (solo para los relativos). */
export function describeComparisonDef(def: ComparisonPeriodDef): string | null {
    return def.kind in RELATIVE_PERIOD_LABELS ? RELATIVE_PERIOD_LABELS[def.kind as keyof typeof RELATIVE_PERIOD_LABELS] : null;
}

/** True si el período ya está en la tabla, aunque esté definido de otra forma. */
export function isDuplicatePeriod(state: ComparisonState, def: ComparisonPeriodDef, base: PeriodOption): boolean {
    const candidate = resolveComparisonPeriod(def, base);
    if (!candidate) return false;
    const key = periodKey(candidate);
    return state.rows.some((row) => {
        const resolved = resolveComparisonPeriod(row.def, base);
        return resolved !== null && periodKey(resolved) === key;
    });
}

export function countVisible(state: ComparisonState): number {
    return state.rows.filter((row) => row.visible).length;
}

/** Por qué no se puede cambiar la visibilidad de una fila: tope de visibles o última visible. */
export function visibilityBlocker(state: ComparisonState, rowId: string): "max" | "last" | null {
    const row = state.rows.find((r) => r.id === rowId);
    if (!row) return null;
    if (row.visible) return countVisible(state) <= 1 ? "last" : null;
    return countVisible(state) >= MAX_VISIBLE_PERIODS ? "max" : null;
}

/** Conserva el color propio si está libre entre los visibles; si no, toma el primero libre. */
function pickColor(rows: ComparisonRow[], rowId: string, preferred: number): number {
    const used = new Set(rows.filter((r) => r.visible && r.id !== rowId).map((r) => r.colorIndex));
    if (!used.has(preferred) && preferred >= 0 && preferred < MAX_VISIBLE_PERIODS) return preferred;
    for (let i = 0; i < MAX_VISIBLE_PERIODS; i++) if (!used.has(i)) return i;
    return 0;
}

/** Si quedan filas pero ninguna visible, muestra la primera. */
function ensureOneVisible(rows: ComparisonRow[]): ComparisonRow[] {
    if (rows.length === 0 || rows.some((r) => r.visible)) return rows;
    const [first, ...rest] = rows;
    return [{ ...first, visible: true, colorIndex: pickColor(rows, first.id, first.colorIndex) }, ...rest];
}

/** Agrega la fila arriba de todo; queda visible si todavía no se llegó al tope. */
export function addComparisonRow(state: ComparisonState, def: ComparisonPeriodDef, id: string): ComparisonState {
    const visible = countVisible(state) < MAX_VISIBLE_PERIODS;
    const colorIndex = visible ? pickColor(state.rows, id, 0) : 0;
    return { ...state, rows: [{ id, def, visible, colorIndex }, ...state.rows] };
}

export function toggleComparisonRow(state: ComparisonState, rowId: string): ComparisonState {
    if (visibilityBlocker(state, rowId)) return state;
    return {
        ...state,
        rows: state.rows.map((row) => {
            if (row.id !== rowId) return row;
            const visible = !row.visible;
            return { ...row, visible, colorIndex: visible ? pickColor(state.rows, row.id, row.colorIndex) : row.colorIndex };
        }),
    };
}

/** Quita una fila; si era la única visible y quedan otras, muestra la primera. */
export function removeComparisonRow(state: ComparisonState, rowId: string): ComparisonState {
    return { ...state, rows: ensureOneVisible(state.rows.filter((row) => row.id !== rowId)) };
}

/** Mueve una fila a `toIndex` (posición final en la tabla); la primera pasa a ser la referencia. */
export function moveComparisonRow(state: ComparisonState, rowId: string, toIndex: number): ComparisonState {
    const from = state.rows.findIndex((row) => row.id === rowId);
    if (from === -1) return state;
    const target = Math.max(0, Math.min(toIndex, state.rows.length - 1));
    if (target === from) return state;
    const rows = [...state.rows];
    const [moved] = rows.splice(from, 1);
    rows.splice(target, 0, moved);
    return { ...state, rows };
}

export function createComparisonRowId(): string {
    return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseDef(raw: unknown): ComparisonPeriodDef | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    switch (value.kind) {
        case "mes-dashboard":
        case "mes-anterior":
        case "anio-anterior":
            return { kind: value.kind };
        case "mes": {
            const { year, month } = value;
            return Number.isInteger(year) && Number.isInteger(month) && (month as number) >= 0 && (month as number) <= 11
                ? { kind: "mes", year: year as number, month: month as number }
                : null;
        }
        case "rango": {
            const { desde, hasta } = value;
            return typeof desde === "string" && typeof hasta === "string" && buildRangePeriod(desde, hasta)
                ? { kind: "rango", desde, hasta }
                : null;
        }
        default:
            return null;
    }
}

/**
 * Reconstruye el estado guardado en localStorage descartando lo inválido y restableciendo los
 * invariantes: ids únicos, a lo sumo MAX_VISIBLE_PERIODS visibles, al menos uno visible si hay filas
 * y colores sin repetir entre los visibles. Una tabla vaciada a propósito se respeta.
 */
export function parseComparisonState(raw: unknown): ComparisonState {
    if (!raw || typeof raw !== "object") return DEFAULT_COMPARISON_STATE;
    const value = raw as Record<string, unknown>;
    if (!Array.isArray(value.rows)) return DEFAULT_COMPARISON_STATE;

    const rows: ComparisonRow[] = [];
    const seen = new Set<string>();
    for (const rawRow of value.rows) {
        if (!rawRow || typeof rawRow !== "object") continue;
        const row = rawRow as Record<string, unknown>;
        const def = parseDef(row.def);
        if (typeof row.id !== "string" || !row.id || seen.has(row.id) || !def) continue;
        seen.add(row.id);

        const visible = row.visible === true && rows.filter((r) => r.visible).length < MAX_VISIBLE_PERIODS;
        const colorIndex = visible ? pickColor(rows, row.id, Number(row.colorIndex)) : 0;
        rows.push({ id: row.id, def, visible, colorIndex });
    }

    return { open: value.open === true, rows: ensureOneVisible(rows) };
}
