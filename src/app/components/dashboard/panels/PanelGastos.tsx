"use client";

import React from "react";

import GraficoGastos from "@/app/components/graficos/GraficoGastos";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, TYPOGRAPHY } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    gastosData: Array<{ label: string; repuestos: number; sueldos: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelGastos({ gastosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Evolución de Gastos" headerAction={headerAction}>
                <GraficoGastos data={gastosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div className="flex flex-col xl:flex-row gap-4 mt-2">
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por categoría</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <DesglosePieChart items={stats?.costoPorTipo} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                    <div className="w-full xl:w-1/2 flex flex-col">
                        <h4 style={TYPOGRAPHY.dashboard.chartTitle}>Costo por empleado</h4>
                        <div className="flex-1 flex flex-col justify-center">
                            <DesglosePieChart items={stats?.costoPorEmpleado} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}
