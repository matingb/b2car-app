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
import type { GastosBucket } from "@/lib/dashboard/cards";

type Props = {
    id?: string;
    data?: GastosBucket[];
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    repuestos: "Repuestos",
    sueldos: "Sueldos",
    eventuales: "Gastos eventuales",
};

export default function GraficoGastos({ id = "grafico-gastos", data, granularity = "day" }: Props) {
    // Por mes se comparan los componentes lado a lado; por día o semana se apilan.
    const isMonthly = granularity === "month";

    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            repuestos: d.repuestos,
            sueldos: d.sueldos,
            eventuales: d.eventuales,
        }));

        const config: ChartConfig = {
            repuestos: { label: "Repuestos", color: COLOR.GRAPHICS_DANGER.PRIMARY },
            sueldos: { label: "Sueldos", color: COLOR.GRAPHICS_DANGER.TERTIARY },
            eventuales: { label: "Gastos eventuales", color: COLOR.GRAPHICS_DANGER.SECONDARY },
        };

        return { chartData, config };
    }, [data]);

    const stackId = isMonthly ? undefined : "a";

    return (
        <ScrollableChart categories={chartData.length} granularity={granularity}>
            <ChartContainer id={id} config={config} className="w-full h-[220px]">
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
                    <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={LABELS} formatter={formatCurrency} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId={stackId} radius={isMonthly ? [3, 3, 0, 0] : undefined} />
                    <Bar dataKey="sueldos" fill="var(--color-sueldos)" stackId={stackId} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="eventuales" fill="var(--color-eventuales)" stackId={stackId} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ChartContainer>
        </ScrollableChart>
    );
}
