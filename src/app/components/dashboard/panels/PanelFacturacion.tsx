
"use client";

import React from "react";

import GraficoIngresos from "@/app/components/graficos/GraficoIngresos";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    ingresosData: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelFacturacion({ ingresosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Facturación" headerAction={headerAction}>
                <GraficoIngresos data={ingresosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div className="flex flex-col xl:flex-row gap-4 mt-2">
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Facturación por categoría</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <DesglosePieChart items={stats?.facturacionPorTipo} montoLabel="Facturación" />
                        </div>
                    </div>
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Facturación por empleado</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <DesglosePieChart items={stats?.facturacionPorEmpleado} montoLabel="Facturación" />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}
