
"use client";

import React from "react";

import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    arreglosData: Array<{ label: string; cantidad: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelArreglos({ arreglosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Arreglos realizados" headerAction={headerAction}>
                <GraficoArreglos data={arreglosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div className="flex flex-col xl:flex-row gap-4 mt-2">
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Arreglos por tipo</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <DesglosePieChart
                                items={stats?.facturacionPorTipo ?? []}
                                montoLabel="Ingresos"
                            />
                        </div>
                    </div>
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Estado de pago</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <EstadoCobroArreglos
                                total={stats?.totals?.arreglos ?? null}
                                cobrados={stats?.arreglos?.cobrados ?? null}
                                pendientes={stats?.arreglos?.pendientes ?? null}
                            />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}
