"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import GraficoTooltip from "./GraficoTooltip";
import ScrollableChart from "./ScrollableChart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type Granularity } from "@/lib/dashboard/aggregation";
import type { ArreglosBucket } from "@/lib/dashboard/cards";

type Props = {
    id?: string;
    data?: ArreglosBucket[];
    granularity?: Granularity;
};

export default function GraficoArreglos({ id = "grafico-arreglos", data, granularity = "day" }: Props) {
    const isMonthly = granularity === "month";

    const { chartData, config } = useMemo(() => {
        const chartData = (data ?? []).map((d) => ({
            label: d.label,
            cantidad: d.cantidad,
        }));

        const config: ChartConfig = {
            cantidad: {
                label: "Arreglos",
                color: COLOR.GRAPHICS.PRIMARY,
            },
        };

        return { chartData, config };
    }, [data]);

    return (
        <ScrollableChart categories={chartData.length} granularity={granularity}>
            <ChartContainer id={id} config={config} className="w-full h-[220px]">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                        width={28}
                        allowDecimals={false}
                    />
                    <ChartTooltip cursor={false} content={<GraficoTooltip labelMap={{ cantidad: "Arreglos" }} />} />
                    <Bar
                        dataKey="cantidad"
                        fill="var(--color-cantidad)"
                        radius={[3, 3, 0, 0]}
                    />
                </BarChart>
            </ChartContainer>
        </ScrollableChart>
    );
}
