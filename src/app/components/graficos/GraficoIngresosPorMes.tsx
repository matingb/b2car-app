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
    data?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function GraficoIngresosPorMes({ data }: Props) {
    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            mano_de_obra: d.mano_de_obra,
            repuestos: d.repuestos,
            ventas: d.ventas,
        }));

        const config: ChartConfig = {
            mano_de_obra: {
                label: "Mano de obra",
                color: COLOR.GRAPHICS.PRIMARY,
            },
            repuestos: {
                label: "Repuestos",
                color: COLOR.GRAPHICS.TERTIARY,
            },
            ventas: {
                label: "Ventas",
                color: COLOR.GRAPHICS.QUINARY,
            },
        };

        return { chartData, config };
    }, [data]);

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
                <Bar dataKey="mano_de_obra" fill="var(--color-mano_de_obra)" stackId="a" />
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="ventas" fill="var(--color-ventas)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
