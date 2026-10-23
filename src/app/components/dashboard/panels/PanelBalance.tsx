"use client";

import React from "react";
import GraficoBalance from "@/app/components/graficos/GraficoBalance";
import GraficoComparacion from "@/app/components/graficos/GraficoComparacion";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import PeriodComparison from "@/app/components/dashboard/comparacion/PeriodComparison";
import type { CardChartPeriods, DashboardComparison } from "@/app/hooks/dashboard/useDashboardControls";
import type { Granularity } from "@/lib/dashboard/aggregation";
import { CARD_CHART, COMPARISON_COLUMNS } from "@/lib/dashboard/cards";

type Props = {
    periods: CardChartPeriods["balance"];
    granularity: Granularity;
    comparison: DashboardComparison;
    headerAction?: React.ReactNode;
};

export default function PanelBalance({ periods, granularity, comparison, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Balance Histórico" headerAction={headerAction}>
                {periods.length > 1 ? (
                    <GraficoComparacion
                        id="balance-comparacion"
                        periods={periods}
                        granularity={granularity}
                        chart={CARD_CHART.balance}
                    />
                ) : (
                    <GraficoBalance id="balance-principal" data={periods[0]?.buckets ?? []} granularity={granularity} />
                )}
                <PeriodComparison comparison={comparison} columns={COMPARISON_COLUMNS.balance} />
            </DashboardSectionCard>
        </div>
    );
}
