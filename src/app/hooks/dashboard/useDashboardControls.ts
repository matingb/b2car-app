"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/app/providers/DashboardProvider";
import { buildPeriodOptions, type PeriodOption } from "@/app/components/dashboard/PeriodSelector";
import { applyGranularity, type Granularity } from "@/lib/dashboard/aggregation";
import { COLOR } from "@/theme/theme";

export type ActiveCard = "arreglos" | "facturacion" | "gastos" | "balance";

export const ACTIVE_CARDS: ActiveCard[] = ["arreglos", "facturacion", "gastos", "balance"];

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

export function useDashboardControls() {
    const { stats, loading, error, fetchStats } = useDashboard();

    const [period, setPeriod] = useState<PeriodOption>(() => buildPeriodOptions(1)[0]);
    const [granularity, setGranularity] = useState<Record<ActiveCard, Granularity>>(loadGranularity);

    useEffect(() => {
        fetchStats({ from: period.from, to: period.to });
    }, [fetchStats, period.from, period.to]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(granularity));
    }, [granularity]);

    const handlePeriodChange = useCallback(
        (newPeriod: PeriodOption) => {
            setPeriod(newPeriod);
            fetchStats({ from: newPeriod.from, to: newPeriod.to });
        },
        [fetchStats]
    );

    const arreglosData = useMemo(
        () => applyGranularity(
            stats?.arreglosPorPeriodo ?? [],
            granularity.arreglos,
            period.from,
            (label, items) => ({ label, cantidad: items.reduce((s, i) => s + i.cantidad, 0) }),
        ),
        [stats?.arreglosPorPeriodo, granularity.arreglos, period.from]
    );

    const ingresosData = useMemo(
        () => applyGranularity(
            stats?.ingresosPorPeriodo ?? [],
            granularity.facturacion,
            period.from,
            (label, items) => ({
                label,
                mano_de_obra: items.reduce((s, i) => s + i.mano_de_obra, 0),
                repuestos: items.reduce((s, i) => s + i.repuestos, 0),
                ventas: items.reduce((s, i) => s + i.ventas, 0),
            }),
        ),
        [stats?.ingresosPorPeriodo, granularity.facturacion, period.from]
    );

    const gastosData = useMemo(
        () => applyGranularity(
            stats?.gastosPorPeriodo ?? [],
            granularity.gastos,
            period.from,
            (label, items) => ({
                label,
                repuestos: items.reduce((s, i) => s + i.repuestos, 0),
                sueldos: items.reduce((s, i) => s + i.sueldos, 0),
            }),
        ),
        [stats?.gastosPorPeriodo, granularity.gastos, period.from]
    );

    const ingresosBalanceData = useMemo(
        () => applyGranularity(
            stats?.ingresosPorPeriodo ?? [],
            granularity.balance,
            period.from,
            (label, items) => ({
                label,
                mano_de_obra: items.reduce((s, i) => s + i.mano_de_obra, 0),
                repuestos: items.reduce((s, i) => s + i.repuestos, 0),
                ventas: items.reduce((s, i) => s + i.ventas, 0),
            }),
        ),
        [stats?.ingresosPorPeriodo, granularity.balance, period.from]
    );

    const gastosBalanceData = useMemo(
        () => applyGranularity(
            stats?.gastosPorPeriodo ?? [],
            granularity.balance,
            period.from,
            (label, items) => ({
                label,
                repuestos: items.reduce((s, i) => s + i.repuestos, 0),
                sueldos: items.reduce((s, i) => s + i.sueldos, 0),
            }),
        ),
        [stats?.gastosPorPeriodo, granularity.balance, period.from]
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
        arreglosData,
        ingresosData,
        gastosData,
        ingresosBalanceData,
        gastosBalanceData,
        balanceValue,
        balanceColor,
    };
}
