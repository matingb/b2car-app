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
import type { IngresosBucket } from "@/lib/dashboard/cards";

type Props = {
    id?: string;
    data?: IngresosBucket[];
    granularity?: Granularity;
};

function formatCurrency(value: number) {
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

const LABELS: Record<string, string> = {
    mano_de_obra: "Mano de obra",
    repuestos: "Repuestos",
    ventas: "Ventas",
};

export default function GraficoIngresos({ id = "grafico-ingresos", data, granularity = "day" }: Props) {
    // Por mes se comparan los componentes lado a lado; por día o semana se apilan.
    const isMonthly = granularity === "month";

    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            mano_de_obra: d.mano_de_obra,
            repuestos: d.repuestos,
            ventas: d.ventas,
        }));

        const config: ChartConfig = {
            mano_de_obra: { label: "Mano de obra", color: COLOR.GRAPHICS.PRIMARY },
            repuestos: { label: "Repuestos", color: COLOR.GRAPHICS.TERTIARY },
            ventas: { label: "Ventas", color: COLOR.GRAPHICS.QUINARY },
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
                    <Bar dataKey="mano_de_obra" fill="var(--color-mano_de_obra)" stackId={stackId} radius={isMonthly ? [3, 3, 0, 0] : undefined} />
                    <Bar dataKey="repuestos" fill="var(--color-repuestos)" stackId={stackId} radius={isMonthly ? [3, 3, 0, 0] : undefined} />
                    <Bar dataKey="ventas" fill="var(--color-ventas)" stackId={stackId} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ChartContainer>
        </ScrollableChart>
    );
}
