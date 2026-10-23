"use client";

import React from "react";
import { css } from "@emotion/react";
import GraficoIngresos from "@/app/components/graficos/GraficoIngresos";
import GraficoComparacion from "@/app/components/graficos/GraficoComparacion";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import PeriodComparison from "@/app/components/dashboard/comparacion/PeriodComparison";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { CardChartPeriods, DashboardComparison } from "@/app/hooks/dashboard/useDashboardControls";
import type { Granularity } from "@/lib/dashboard/aggregation";
import { CARD_CHART, COMPARISON_COLUMNS } from "@/lib/dashboard/cards";

type Props = {
    periods: CardChartPeriods["facturacion"];
    granularity: Granularity;
    stats: DashboardStats | null;
    comparison: DashboardComparison;
    headerAction?: React.ReactNode;
};

export default function PanelFacturacion({ periods, granularity, stats, comparison, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Facturación" headerAction={headerAction}>
                {periods.length > 1 ? (
                    <GraficoComparacion
                        id="facturacion-comparacion"
                        periods={periods}
                        granularity={granularity}
                        chart={CARD_CHART.facturacion}
                    />
                ) : (
                    <GraficoIngresos id="facturacion-principal" data={periods[0]?.buckets ?? []} granularity={granularity} />
                )}
                <PeriodComparison comparison={comparison} columns={COMPARISON_COLUMNS.facturacion} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div css={styles.mainPanel}>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Facturación por categoría</h4>
                        <div css={styles.chartWrapper}>
                            <DesglosePieChart id="facturacion-categoria" items={stats?.facturacionPorTipo} montoLabel="Facturación" />
                        </div>
                    </div>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Facturación por empleado</h4>
                        <div css={styles.chartWrapper}>
                            <DesglosePieChart id="facturacion-empleado" items={stats?.facturacionPorEmpleado} montoLabel="Facturación" />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}

const styles = {
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 8,
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            flexDirection: "column",
        },
    }),
    halfPanel: css({
        width: "50%",
        display: "flex",
        flexDirection: "column",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            width: "100%",
        },
    }),
    chartWrapper: css({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
    }),
};
