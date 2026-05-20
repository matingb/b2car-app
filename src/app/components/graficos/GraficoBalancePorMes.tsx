"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
    ingresosPorPeriodo?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    gastosPorPeriodo?: Array<{ label: string; repuestos: number; sueldos: number }>;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function GraficoBalancePorMes({ ingresosPorPeriodo, gastosPorPeriodo }: Props) {
    const { chartData, config } = useMemo(() => {
        const ingresosMap = new Map(
            (ingresosPorPeriodo ?? []).map((d) => [
                d.label,
                d.mano_de_obra + d.repuestos + d.ventas,
            ])
        );

        const chartData = (gastosPorPeriodo ?? []).map((d) => {
            const ingresos = ingresosMap.get(d.label) ?? 0;
            const gastos = d.repuestos + d.sueldos;
            return { label: d.label, ingresos, gastos };
        });

        const config: ChartConfig = {
            ingresos: {
                label: "Facturación",
                color: COLOR.SEMANTIC.SUCCESS,
            },
            gastos: {
                label: "Gastos",
                color: COLOR.SEMANTIC.DANGER,
            },
        };

        return { chartData, config };
    }, [ingresosPorPeriodo, gastosPorPeriodo]);

    return (
        <ChartContainer config={config} className="w-full h-[220px]">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={64}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                    cursor={false}
                    content={
                        <ChartTooltipContent
                            formatter={(value) => formatCurrency(Number(value))}
                            labelFormatter={(_, payload) =>
                                payload?.[0]?.payload?.label ?? ""
                            }
                        />
                    }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
