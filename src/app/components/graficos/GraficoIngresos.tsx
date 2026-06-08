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
    data?: Array<{ label: string; mano_de_obra: number; repuestos: number; ventas: number }>;
    isMonthly?: boolean;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    mano_de_obra: "Mano de obra",
    repuestos: "Repuestos",
    ventas: "Ventas",
};

const MONTHLY_LABELS: Record<string, string> = {
    valor: "Monto",
};

export default function GraficoIngresos({ data, isMonthly = false }: Props) {
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

    const { monthlyChartData, monthlyConfig } = useMemo(() => {
        const totals = (data ?? []).reduce(
            (acc, item) => ({
                mano_de_obra: acc.mano_de_obra + item.mano_de_obra,
                repuestos: acc.repuestos + item.repuestos,
                ventas: acc.ventas + item.ventas,
            }),
            { mano_de_obra: 0, repuestos: 0, ventas: 0 }
        );

        const monthlyChartData = [
            { label: "Mano de obra", valor: totals.mano_de_obra, color: COLOR.GRAPHICS.PRIMARY },
            { label: "Repuestos", valor: totals.repuestos, color: COLOR.GRAPHICS.TERTIARY },
            { label: "Ventas", valor: totals.ventas, color: COLOR.GRAPHICS.QUINARY },
        ];

        const monthlyConfig: ChartConfig = {
            valor: {
                label: "Monto",
                color: COLOR.GRAPHICS.PRIMARY,
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
                <Bar dataKey="mano_de_obra" fill="var(--color-mano_de_obra)" stackId="a" />
                <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId="a" />
                <Bar dataKey="ventas" fill="var(--color-ventas)" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
