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
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

type Props = {
    data?: Array<{ label: string; repuestos: number; sueldos: number }>;
    isMonthly?: boolean;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    repuestos: "Repuestos",
    sueldos: "Sueldos",
};

const MONTHLY_LABELS: Record<string, string> = {
    valor: "Monto",
};

export default function GraficoGastos({ data, isMonthly = false }: Props) {
    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            repuestos: d.repuestos,
            sueldos: d.sueldos,
        }));

        const config: ChartConfig = {
            repuestos: {
                label: "Repuestos",
                color: COLOR.GRAPHICS_DANGER.PRIMARY,
            },
            sueldos: {
                label: "Sueldos",
                color: COLOR.GRAPHICS_DANGER.TERTIARY,
            },
        };

        return { chartData, config };
    }, [data]);

    const { monthlyChartData, monthlyConfig } = useMemo(() => {
        const totals = (data ?? []).reduce(
            (acc, item) => ({
                repuestos: acc.repuestos + item.repuestos,
                sueldos: acc.sueldos + item.sueldos,
            }),
            { repuestos: 0, sueldos: 0 }
        );

        const monthlyChartData = [
            { label: "Repuestos", valor: totals.repuestos, color: COLOR.GRAPHICS_DANGER.PRIMARY },
            { label: "Sueldos", valor: totals.sueldos, color: COLOR.GRAPHICS_DANGER.TERTIARY },
        ];

        const monthlyConfig: ChartConfig = {
            valor: {
                label: "Monto",
                color: COLOR.GRAPHICS_DANGER.PRIMARY,
            },
        };

        return { monthlyChartData, monthlyConfig };
    }, [data]);

    if (isMonthly) {
        return (
            <ChartContainer config={monthlyConfig} className="w-full h-[220px]">
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={0}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={64}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={MONTHLY_LABELS} formatter={formatCurrency} />} />
                    <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                        {monthlyChartData.map((entry) => (
                            <Cell key={entry.label} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>
        );
    }

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
                <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={LABELS} formatter={formatCurrency} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="sueldos" fill="var(--color-sueldos)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
