
"use client";

import React from "react";

import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import GraficoComparacion from "@/app/components/graficos/GraficoComparacion";
import VolumenDeTrabajo from "@/app/components/graficos/VolumenDeTrabajo";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import HorasTrabajadasPorEmpleado from "@/app/components/graficos/HorasTrabajadasPorEmpleado";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import PeriodComparison from "@/app/components/dashboard/comparacion/PeriodComparison";
import { TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { CardChartPeriods, DashboardComparison } from "@/app/hooks/dashboard/useDashboardControls";
import type { Granularity } from "@/lib/dashboard/aggregation";
import { CARD_CHART, COMPARISON_COLUMNS } from "@/lib/dashboard/cards";

type Props = {
    periods: CardChartPeriods["arreglos"];
    granularity: Granularity;
    stats: DashboardStats | null;
    comparison: DashboardComparison;
    headerAction?: React.ReactNode;
};

export default function PanelArreglos({ periods, granularity, stats, comparison, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Arreglos realizados" headerAction={headerAction}>
                {periods.length > 1 ? (
                    <GraficoComparacion
                        id="arreglos-comparacion"
                        periods={periods}
                        granularity={granularity}
                        chart={CARD_CHART.arreglos}
                    />
                ) : (
                    <GraficoArreglos id="arreglos-principal" data={periods[0]?.buckets ?? []} granularity={granularity} />
                )}
                <PeriodComparison comparison={comparison} columns={COMPARISON_COLUMNS.arreglos} />
            </DashboardSectionCard>

            <DashboardSectionCard title="Horas trabajadas por empleado">
                <HorasTrabajadasPorEmpleado data={stats?.horasTrabajadasPorEmpleado} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Volumen de trabajo por categoría</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <VolumenDeTrabajo id="arreglos-volumen" items={stats?.facturacionPorTipo ?? []} />
                        </div>
                    </div>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Estado de pago</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <EstadoCobroArreglos
                                id="arreglos-estado-pago"
                                total={stats?.totals?.arreglos ?? null}
                                cobrados={stats?.arreglos?.cobrados ?? null}
                                parciales={stats?.arreglos?.parciales ?? null}
                                pendientes={stats?.arreglos?.pendientes ?? null}
                                montoCobradoTotal={stats?.arreglos?.montoCobradoTotal ?? null}
                                montoCobradoParcial={stats?.arreglos?.montoCobradoParcial ?? null}
                                montoPendienteParcial={stats?.arreglos?.montoPendienteParcial ?? null}
                                montoPendiente={stats?.arreglos?.montoPendiente ?? null}
                            />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}
