"use client";

import React, { useState, useEffect, useCallback } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useDashboard } from "@/app/providers/DashboardProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { CircleDollarSign, Scale, TrendingDown, Wrench } from "lucide-react";
import DashboardMetricCard from "@/app/components/dashboard/DashboardMetricCard";
import DashboardExpandablePanel from "@/app/components/dashboard/DashboardExpandablePanel";
import PeriodSelector, { buildPeriodOptions, type PeriodOption } from "@/app/components/dashboard/PeriodSelector";
import GranularitySelector from "@/app/components/dashboard/GranularitySelector";
import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import GraficoIngresos from "@/app/components/graficos/GraficoIngresos";
import GraficoGastos from "@/app/components/graficos/GraficoGastos";
import GraficoBalance from "@/app/components/graficos/GraficoBalance";
import { applyGranularity, type Granularity } from "@/lib/dashboard/aggregation";
import CantidadTiposArreglos from "@/app/components/graficos/CantidadTiposArreglos";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import RecentActivityCard from "@/app/components/dashboard/RecentActivityCard";
import Card from "@/app/components/ui/Card";

type ActiveCard = "arreglos" | "facturacion" | "gastos" | "balance";

const PANEL_TITLES: Record<ActiveCard, string> = {
    arreglos: "Arreglos realizados",
    facturacion: "Facturación",
    gastos: "Gastos",
    balance: "Balance",
};

function defaultPeriod(): PeriodOption {
    return buildPeriodOptions(1)[0];
}

export default function DashboardPage() {
    const { stats, loading, error, fetchStats } = useDashboard();
    const [activeCard, setActiveCard] = useState<ActiveCard>("facturacion");
    const [period, setPeriod] = useState<PeriodOption>(defaultPeriod);
    const [granularity, setGranularity] = useState<Record<ActiveCard, Granularity>>({
        arreglos: "day",
        facturacion: "day",
        gastos: "day",
        balance: "day",
    });

    const handlePeriodChange = useCallback(
        (newPeriod: PeriodOption) => {
            setPeriod(newPeriod);
            fetchStats({ from: newPeriod.from, to: newPeriod.to });
        },
        [fetchStats]
    );

    useEffect(() => {
        fetchStats({ from: period.from, to: period.to });
    }, [fetchStats, period.from, period.to]);

    const arreglosData = applyGranularity(
        stats?.arreglosPorPeriodo ?? [],
        granularity.arreglos,
        period.from,
        (label, items) => ({ label, cantidad: items.reduce((s, i) => s + i.cantidad, 0) }),
    );

    const ingresosData = applyGranularity(
        stats?.ingresosPorPeriodo ?? [],
        granularity.facturacion,
        period.from,
        (label, items) => ({
            label,
            mano_de_obra: items.reduce((s, i) => s + i.mano_de_obra, 0),
            repuestos: items.reduce((s, i) => s + i.repuestos, 0),
            ventas: items.reduce((s, i) => s + i.ventas, 0),
        }),
    );

    const gastosData = applyGranularity(
        stats?.gastosPorPeriodo ?? [],
        granularity.gastos,
        period.from,
        (label, items) => ({
            label,
            repuestos: items.reduce((s, i) => s + i.repuestos, 0),
            sueldos: items.reduce((s, i) => s + i.sueldos, 0),
        }),
    );

    const ingresosBalanceData = applyGranularity(
        stats?.ingresosPorPeriodo ?? [],
        granularity.balance,
        period.from,
        (label, items) => ({
            label,
            mano_de_obra: items.reduce((s, i) => s + i.mano_de_obra, 0),
            repuestos: items.reduce((s, i) => s + i.repuestos, 0),
            ventas: items.reduce((s, i) => s + i.ventas, 0),
        }),
    );

    const gastosBalanceData = applyGranularity(
        stats?.gastosPorPeriodo ?? [],
        granularity.balance,
        period.from,
        (label, items) => ({
            label,
            repuestos: items.reduce((s, i) => s + i.repuestos, 0),
            sueldos: items.reduce((s, i) => s + i.sueldos, 0),
        }),
    );

    const balanceValue = stats?.totals?.balance ?? undefined;
    const balanceColor =
        balanceValue === undefined
            ? COLOR.ACCENT.PRIMARY
            : balanceValue >= 0
            ? COLOR.SEMANTIC.SUCCESS
            : COLOR.SEMANTIC.DANGER;

    function makeGranularitySelector(card: ActiveCard) {
        return (
            <GranularitySelector
                value={granularity[card]}
                onChange={(g) => setGranularity((prev) => ({ ...prev, [card]: g }))}
            />
        );
    }

    return (
        <div>
            <div css={styles.headerRow}>
                <ScreenHeader title="Dashboard" />
                <PeriodSelector value={period} onChange={handlePeriodChange} />
            </div>

            {/* 4 cards de métricas de negocio */}
            <div css={styles.cardGrid}>
                <DashboardMetricCard
                    titleText="Arreglos realizados"
                    value={stats?.totals?.arreglosEsteMes}
                    icon={<Wrench size={20} color={COLOR.ACCENT.PRIMARY} />}
                    isActive={activeCard === "arreglos"}
                    onClick={() => setActiveCard("arreglos")}
                />
                <DashboardMetricCard
                    titleText="Facturación"
                    value={stats?.totals?.montoIngresos}
                    prefix="$"
                    icon={<CircleDollarSign size={20} color={COLOR.ACCENT.PRIMARY} />}
                    isActive={activeCard === "facturacion"}
                    onClick={() => setActiveCard("facturacion")}
                />
                <DashboardMetricCard
                    titleText="Gastos"
                    value={stats?.totals?.gastos}
                    prefix="$"
                    icon={<TrendingDown size={20} color={COLOR.SEMANTIC.DANGER} />}
                    isActive={activeCard === "gastos"}
                    onClick={() => setActiveCard("gastos")}
                    valueColor={COLOR.SEMANTIC.DANGER}
                />
                <DashboardMetricCard
                    titleText="Balance"
                    value={balanceValue}
                    prefix="$"
                    icon={<Scale size={20} color={balanceColor} />}
                    isActive={activeCard === "balance"}
                    onClick={() => setActiveCard("balance")}
                    valueColor={balanceColor}
                />
            </div>

            {/* Panel expandible según la card seleccionada */}
            <div style={{ marginTop: 12 }}>
                {(["arreglos", "facturacion", "gastos", "balance"] as ActiveCard[]).map((card) => (
                    <DashboardExpandablePanel
                        key={card}
                        isOpen={activeCard === card}
                        title={PANEL_TITLES[card]}
                        headerAction={makeGranularitySelector(card)}
                    >
                        {loading ? (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        ) : error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>{error}</div>
                        ) : card === "arreglos" ? (
                            <GraficoArreglos data={arreglosData} />
                        ) : card === "facturacion" ? (
                            <GraficoIngresos data={ingresosData} />
                        ) : card === "gastos" ? (
                            <GraficoGastos data={gastosData} />
                        ) : (
                            <GraficoBalance
                                ingresosPorPeriodo={ingresosBalanceData}
                                gastosPorPeriodo={gastosBalanceData}
                            />
                        )}
                    </DashboardExpandablePanel>
                ))}
            </div>

            <div css={styles.mainPanel}>
                <div css={styles.halfPanel}>
                    <h3 css={styles.title}>Arreglos | Tipos</h3>
                    <Card>
                        {loading && (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        )}
                        {error && (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>{error}</div>
                        )}
                        <CantidadTiposArreglos
                            items={(() => {
                                const tipos = stats?.arreglos?.tipos?.tipos ?? [];
                                const cantidad = stats?.arreglos?.tipos?.cantidad ?? [];
                                const ingresos = stats?.arreglos?.tipos?.ingresos ?? [];
                                const len = Math.min(tipos.length, cantidad.length, ingresos.length);
                                return Array.from({ length: len }).map((_, idx) => ({
                                    tipo: tipos[idx] ?? `Tipo ${idx + 1}`,
                                    cantidad: cantidad[idx] ?? 0,
                                    ingresos: ingresos[idx] ?? 0,
                                }));
                            })()}
                        />
                    </Card>
                </div>

                <div css={styles.halfPanel}>
                    <h3 css={styles.title}>Arreglos | Estado de pago</h3>
                    <Card>
                        {loading && (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        )}
                        {error && (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>{error}</div>
                        )}
                        <EstadoCobroArreglos
                            total={stats?.totals?.arreglos ?? null}
                            cobrados={stats?.arreglos?.cobrados ?? null}
                            pendientes={stats?.arreglos?.pendientes ?? null}
                        />
                    </Card>
                </div>
            </div>

            <div style={styles.activityPanel}>
                <div style={{ width: "100%" }}>
                    <h3 css={styles.title}>Actividad Reciente</h3>
                    <div style={styles.activityList}>
                        {(stats?.recentActivities ?? []).map((activity) => (
                            <RecentActivityCard key={activity.id} activity={activity} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    headerRow: css({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
    }),
    cardGrid: css({
        display: "grid",
        gap: 12,
        marginTop: 16,
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        },
    }),
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 24,
        [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
            flexDirection: "column",
        },
    }),
    halfPanel: css({
        width: "50%",
        [`@media (max-width: ${BREAKPOINTS.lg}px)`]: {
            width: "100%",
        },
    }),
    activityPanel: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        marginTop: 24,
    },
    activityList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    title: css({
        fontSize: 20,
        fontWeight: 600,
        marginBottom: 8,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            fontSize: 18,
        },
    }),
} as const;
