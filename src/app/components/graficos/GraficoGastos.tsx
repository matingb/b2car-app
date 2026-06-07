"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import GraficoTooltip from "./GraficoTooltip";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
    data?: Array<{ label: string; repuestos: number; sueldos: number }>;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export default function GraficoGastos({ data }: Props) {
    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            repuestos: d.repuestos,
            sueldos: d.sueldos,
        }));

        const config: ChartConfig = {
            repuestos: {
                label: "Repuestos",
                color: COLOR.GRAPHICS.PRIMARY,
            },
            sueldos: {
                label: "Sueldos",
                color: COLOR.GRAPHICS.TERTIARY,
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
                <ChartTooltip cursor={false} content={<GraficoTooltip titleKey="label" formatter={formatCurrency} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="sueldos" fill="var(--color-sueldos)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
