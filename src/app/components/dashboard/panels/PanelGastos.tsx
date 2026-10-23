"use client";

import React from "react";

import GraficoGastos from "@/app/components/graficos/GraficoGastos";
import GraficoComparacion from "@/app/components/graficos/GraficoComparacion";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import PeriodComparison from "@/app/components/dashboard/comparacion/PeriodComparison";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { CardChartPeriods, DashboardComparison } from "@/app/hooks/dashboard/useDashboardControls";
import type { Granularity } from "@/lib/dashboard/aggregation";
import { CARD_CHART, COMPARISON_COLUMNS } from "@/lib/dashboard/cards";
import { css } from "@emotion/react";

type Props = {
    periods: CardChartPeriods["gastos"];
    granularity: Granularity;
    stats: DashboardStats | null;
    comparison: DashboardComparison;
    headerAction?: React.ReactNode;
};

export default function PanelGastos({ periods, granularity, stats, comparison, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Evolución de Gastos" headerAction={headerAction}>
                {periods.length > 1 ? (
                    <GraficoComparacion
                        id="gastos-comparacion"
                        periods={periods}
                        granularity={granularity}
                        chart={CARD_CHART.gastos}
                    />
                ) : (
                    <GraficoGastos id="gastos-principal" data={periods[0]?.buckets ?? []} granularity={granularity} />
                )}
                <PeriodComparison comparison={comparison} columns={COMPARISON_COLUMNS.gastos} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div css={styles.mainPanel}>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por categoría</h4>
                        <div style={styles.chartWrapper}>
                            <DesglosePieChart id="gastos-categoria" items={stats?.costoPorTipo} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                    <div css={styles.halfPanel}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por empleado</h4>
                        <div style={styles.chartWrapper}>
                            <DesglosePieChart id="gastos-empleado" items={stats?.costoPorEmpleado} montoLabel="Costo" variant="danger" />
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
        flexDirection: "column" as const,
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            width: "100%",
        },
    }),
    chartWrapper: {
        flex: 1,
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "center",
    },
} as const;
