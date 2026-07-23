
"use client";

import React from "react";

import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import CantidadTiposArreglos from "@/app/components/graficos/CantidadTiposArreglos";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { TYPOGRAPHY } from "@/theme/theme";
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Arreglos por tipo</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <CantidadTiposArreglos items={stats?.facturacionPorTipo ?? []} />
                        </div>
                    </div>
                    <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column" }}>
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Estado de pago</h4>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
