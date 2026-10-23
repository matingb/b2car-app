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
import ScrollableChart from "./ScrollableChart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type Granularity } from "@/lib/dashboard/aggregation";
import type { BalanceBucket } from "@/lib/dashboard/cards";

type Props = {
    id?: string;
    data?: BalanceBucket[];
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const CONFIG: ChartConfig = {
    ingresos: { label: "Facturación", color: COLOR.SEMANTIC.SUCCESS },
    gastos: { label: "Gastos", color: COLOR.SEMANTIC.DANGER },
};

export default function GraficoBalance({ id = "grafico-balance", data, granularity = "day" }: Props) {
    const isMonthly = granularity === "month";

    const chartData = useMemo(
        () => (data ?? []).map((d) => ({ label: d.label, ingresos: d.ingresos, gastos: d.gastos })),
        [data],
    );

    return (
        <ScrollableChart categories={chartData.length} granularity={granularity}>
            <ChartContainer id={id} config={CONFIG} className="w-full h-[220px]">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval={isMonthly ? 0 : "preserveStartEnd"}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={64}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip cursor={false} content={<GraficoTooltip formatter={formatCurrency} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ChartContainer>
        </ScrollableChart>
    );
}
