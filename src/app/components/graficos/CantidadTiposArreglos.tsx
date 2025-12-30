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
import { Cell, Pie, PieChart } from "recharts";

type Props = {
    tipos?: string[];
    cantidad?: Array<number | string | null | undefined>;
    className?: string;
};

export default function CantidadTiposArreglos({
    tipos,
    cantidad,
    className,
}: Props) {
    const tipoSeries = useMemo(() => {
        const labels = tipos ?? [];
        const values = cantidad ?? [];

        const len = Math.min(labels.length, values.length);
        const safeLabels = labels.slice(0, len);
        const safeValues = values.slice(0, len).map((n) => Number(n) || 0);

        const keys = safeLabels.map((_, idx) => `tipo_${idx}`);

        const data = keys.map((key, idx) => ({
            key,
            name: safeLabels[idx] ?? key,
            value: safeValues[idx] ?? 0,
        }));

        const colors = [
            COLOR.GRAPHICS.PRIMARY,
            COLOR.GRAPHICS.SECONDARY,
            COLOR.GRAPHICS.TERTIARY,
            COLOR.GRAPHICS.QUATERNARY,
            COLOR.GRAPHICS.QUINARY,
        ];


        const config: ChartConfig = {};
        keys.forEach((key, idx) => {
            const chartVar = (idx % 5) + 1;
            config[key] = {
                label: safeLabels[idx] ?? key,
                color: colors[idx % colors.length],
            };
        });

        return {
            config,
            data,
        };
    }, [tipos, cantidad]);

    return (
        <ChartContainer
            config={tipoSeries.config}
            className={className ?? "w-full "}
        >
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={
                        <ChartTooltipContent indicator="dot" nameKey="key" />
                    }
                />
                <Pie
                    data={tipoSeries.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    isAnimationActive={true}
                    animationDuration={1000}
                    outerRadius="80%"
                    labelLine = {false}
                    label
                >
                    {tipoSeries.data.map((entry) => (
                        <Cell
                            key={entry.key}
                            fill={`var(--color-${entry.key})`}
                        />
                    ))}
                </Pie>

                <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            </PieChart>
        </ChartContainer>
    );
}
