"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/app/providers/DashboardProvider";
import { type Granularity } from "@/lib/dashboard/aggregation";
import { ACTIVE_CARDS, buildCardBuckets, type ActiveCard, type CardBuckets } from "@/lib/dashboard/cards";
import {
    COMPARISON_STORAGE_KEY,
    DASHBOARD_MONTH_ROW_ID,
    DEFAULT_COMPARISON_STATE,
    addComparisonRow,
    createComparisonRowId,
    describeComparisonDef,
    isDuplicatePeriod,
    moveComparisonRow,
    parseComparisonState,
    removeComparisonRow,
    resolveComparisonPeriod,
    toggleComparisonRow,
    visibilityBlocker,
    type ComparisonPeriodDef,
    type ComparisonState,
} from "@/lib/dashboard/comparison";
import { buildPeriodOptions, periodKey, type PeriodOption } from "@/lib/dashboard/periods";
import { MAX_PERIODO_DIAS } from "@/lib/dashboard/range";
import { computePeriodoTotals, type PeriodoTotals } from "@/lib/dashboard/totals";
import type { DashboardPeriodo } from "@/lib/dashboard/types";
import { logger } from "@/lib/logger";
import { COLOR } from "@/theme/theme";

export { ACTIVE_CARDS, type ActiveCard } from "@/lib/dashboard/cards";

const STORAGE_KEY = "b2car.dashboard.granularity";
const GRANULARITY_VALUES: Granularity[] = ["day", "week", "month"];

function isGranularity(value: unknown): value is Granularity {
    return typeof value === "string" && GRANULARITY_VALUES.includes(value as Granularity);
}

function defaultGranularity(): Record<ActiveCard, Granularity> {
    return { arreglos: "day", facturacion: "day", gastos: "day", balance: "day" };
}

function loadGranularity(): Record<ActiveCard, Granularity> {
    const fallback = defaultGranularity();
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<Record<ActiveCard, unknown>>;
        return ACTIVE_CARDS.reduce<Record<ActiveCard, Granularity>>((acc, card) => {
            const value = parsed?.[card];
            acc[card] = isGranularity(value) ? value : fallback[card];
            return acc;
        }, { ...fallback });
    } catch {
        return fallback;
    }
}

function loadComparison(): ComparisonState {
    try {
        const raw = window.localStorage.getItem(COMPARISON_STORAGE_KEY);
        return raw ? parseComparisonState(JSON.parse(raw)) : DEFAULT_COMPARISON_STATE;
    } catch {
        return DEFAULT_COMPARISON_STATE;
    }
}

function saveToStorage(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        logger.warn("No se pudo guardar la preferencia del dashboard", err);
    }
}

/** Una fila de la tabla de comparación, ya resuelta contra el mes del header. */
export type ComparisonRowView = {
    id: string;
    /** La primera fila: el resto calcula su Δ% contra ella. */
    isReference: boolean;
    /** Cubre el mismo rango que el mes del header: usa los datos ya cargados del dashboard. */
    usesDashboardData: boolean;
    label: string;
    /** Aclaración de los períodos relativos ("Mes anterior"). */
    detail: string | null;
    period: PeriodOption;
    visible: boolean;
    color: string;
    visibilityBlocker: "max" | "last" | null;
    status: "loading" | "ready" | "error";
    error: string | null;
    periodo: DashboardPeriodo | null;
    totals: PeriodoTotals | null;
};

/** Un período graficado en una card. */
export type ChartPeriod<B> = { id: string; label: string; color: string; buckets: B };

export type CardChartPeriods = { [C in ActiveCard]: Array<ChartPeriod<CardBuckets[C]>> };

export type AddPeriodResult = { ok: true } | { ok: false; error: string };

function periodColor(index: number): string {
    return COLOR.GRAPHICS_PERIODOS[index] ?? COLOR.GRAPHICS_PERIODOS[0];
}

export function useDashboardControls() {
    const { stats, loading, error, fetchStats, periodos, ensurePeriodo, reloadPeriodo } = useDashboard();

    const [period, setPeriod] = useState<PeriodOption>(() => buildPeriodOptions(1, new Date(), "UTC")[0]);
    const [granularity, setGranularity] = useState<Record<ActiveCard, Granularity>>(defaultGranularity);
    const [comparison, setComparison] = useState<ComparisonState>(DEFAULT_COMPARISON_STATE);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!hydrated) return;
        fetchStats({ from: period.from, to: period.to });
    }, [fetchStats, hydrated, period.from, period.to]);

    useEffect(() => {
        setGranularity(loadGranularity());
        setComparison(loadComparison());
        setPeriod(buildPeriodOptions(1, new Date(), "local")[0]);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        saveToStorage(STORAGE_KEY, granularity);
    }, [hydrated, granularity]);

    useEffect(() => {
        if (!hydrated) return;
        saveToStorage(COMPARISON_STORAGE_KEY, comparison);
    }, [hydrated, comparison]);

    const handlePeriodChange = useCallback(
        (newPeriod: PeriodOption) => {
            setPeriod(newPeriod);
        },
        [],
    );

    // Períodos de la tabla resueltos contra el mes del header (no dependen de los datos cargados).
    const resolvedRows = useMemo(
        () =>
            comparison.rows.flatMap((row) => {
                const resolved = resolveComparisonPeriod(row.def, period);
                if (!resolved) return [];
                return [{ row, period: resolved, matchesHeader: periodKey(resolved) === periodKey(period) }];
            }),
        [comparison.rows, period],
    );

    // Cada período se pide por separado: uno lento o con error no frena a los demás ni al mes del header,
    // que ya viene con las stats. ensurePeriodo ignora los ya pedidos, así que repetir el efecto no
    // duplica requests.
    useEffect(() => {
        if (!hydrated) return;
        resolvedRows
            .filter(({ matchesHeader }) => !matchesHeader)
            .forEach(({ period: p }) => ensurePeriodo({ from: p.from, to: p.to }));
    }, [hydrated, resolvedRows, ensurePeriodo]);

    const headerPeriodo = loading ? null : stats?.periodo ?? null;

    const rows = useMemo<ComparisonRowView[]>(
        () =>
            resolvedRows.map(({ row, period: p, matchesHeader }, index): ComparisonRowView => {
                const entry = matchesHeader ? null : periodos[periodKey(p)];
                const data = matchesHeader ? headerPeriodo : entry?.status === "ready" ? entry.data : null;
                const status = matchesHeader
                    ? headerPeriodo ? "ready" : error ? "error" : "loading"
                    : entry?.status ?? "loading";
                return {
                    id: row.id,
                    isReference: index === 0,
                    usesDashboardData: matchesHeader,
                    label: p.label,
                    detail: describeComparisonDef(row.def),
                    period: p,
                    visible: row.visible,
                    color: periodColor(row.colorIndex),
                    visibilityBlocker: visibilityBlocker(comparison, row.id),
                    status,
                    error: matchesHeader ? error : entry?.status === "error" ? entry.error : null,
                    periodo: data,
                    totals: data ? computePeriodoTotals(data) : null,
                };
            }),
        [comparison, error, headerPeriodo, periodos, resolvedRows],
    );

    const chartPeriods = useMemo<CardChartPeriods>(() => {
        // Sin filas en la tabla, los gráficos muestran el mes del header; con filas, las que tengan el ojo.
        const visibles: Array<Pick<ComparisonRowView, "id" | "label" | "color"> & { periodo: DashboardPeriodo }> =
            comparison.rows.length === 0
                ? headerPeriodo
                    ? [{ id: DASHBOARD_MONTH_ROW_ID, label: period.label, color: periodColor(0), periodo: headerPeriodo }]
                    : []
                : rows.filter((row): row is ComparisonRowView & { periodo: DashboardPeriodo } =>
                    row.visible && row.periodo !== null,
                );
        const forCard = <C extends ActiveCard>(card: C): Array<ChartPeriod<CardBuckets[C]>> =>
            visibles.map((row) => ({
                id: row.id,
                label: row.label,
                color: row.color,
                buckets: buildCardBuckets(card, row.periodo, granularity[card]),
            }));
        return {
            arreglos: forCard("arreglos"),
            facturacion: forCard("facturacion"),
            gastos: forCard("gastos"),
            balance: forCard("balance"),
        };
    }, [comparison.rows.length, granularity, headerPeriodo, period.label, rows]);

    const toggleComparisonOpen = useCallback(() => {
        setComparison((prev) => ({ ...prev, open: !prev.open }));
    }, []);

    const toggleRowVisibility = useCallback((rowId: string) => {
        setComparison((prev) => toggleComparisonRow(prev, rowId));
    }, []);

    const removeRow = useCallback((rowId: string) => {
        setComparison((prev) => removeComparisonRow(prev, rowId));
    }, []);

    const moveRow = useCallback((rowId: string, toIndex: number) => {
        setComparison((prev) => moveComparisonRow(prev, rowId, toIndex));
    }, []);

    const addPeriod = useCallback(
        (def: ComparisonPeriodDef): AddPeriodResult => {
            const resolved = resolveComparisonPeriod(def, period);
            if (!resolved) return { ok: false, error: "La fecha de inicio tiene que ser anterior o igual a la de fin" };
            if (Date.parse(resolved.to) - Date.parse(resolved.from) > MAX_PERIODO_DIAS * 86_400_000) {
                return { ok: false, error: "El período no puede superar los 3 años" };
            }
            if (isDuplicatePeriod(comparison, def, period)) {
                return { ok: false, error: "Ese período ya está en la tabla" };
            }
            setComparison((prev) => addComparisonRow(prev, def, createComparisonRowId()));
            return { ok: true };
        },
        [comparison, period],
    );

    const retryRow = useCallback(
        (rowId: string) => {
            const row = rows.find((r) => r.id === rowId);
            if (!row) return;
            if (row.usesDashboardData) fetchStats({ from: period.from, to: period.to });
            else reloadPeriodo({ from: row.period.from, to: row.period.to });
        },
        [fetchStats, period.from, period.to, reloadPeriodo, rows],
    );

    const balanceValue = stats?.totals?.balance ?? undefined;
    const balanceColor =
        balanceValue === undefined
            ? COLOR.ACCENT.PRIMARY
            : balanceValue >= 0
            ? COLOR.SEMANTIC.SUCCESS
            : COLOR.SEMANTIC.DANGER;

    return {
        stats,
        loading,
        error,
        period,
        handlePeriodChange,
        granularity,
        setGranularity,
        balanceValue,
        balanceColor,
        comparison: {
            open: comparison.open,
            rows,
            toggleOpen: toggleComparisonOpen,
            toggleVisibility: toggleRowVisibility,
            remove: removeRow,
            move: moveRow,
            add: addPeriod,
            /** Mes que muestran los gráficos cuando la tabla queda vacía. */
            fallbackLabel: period.label,
            retry: retryRow,
        },
        chartPeriods,
    };
}

export type DashboardComparison = ReturnType<typeof useDashboardControls>["comparison"];
