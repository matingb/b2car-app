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
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

type Props = {
    total?: number | null;
    cobrados?: number | null;
    pendientes?: number | null;
    className?: string;
};

export default function EstadoCobroArreglos({
    total,
    cobrados,
    pendientes,
    className,
}: Props) {
    const { chartData, domainMax } = useMemo(() => {
        const cobradosValue = Number(cobrados ?? 0);
        const pendientesValue = Number(pendientes ?? 0);
        const totalValue = Number(total ?? cobradosValue + pendientesValue);

        const safeTotal = Number.isFinite(totalValue) ? totalValue : 0;
        const safeCobrados = Number.isFinite(cobradosValue) ? cobradosValue : 0;
        const safePendientes = Number.isFinite(pendientesValue)
            ? pendientesValue
            : 0;

        return {
            chartData: [
                {
                    name: "arreglos",
                    total: safeTotal,
                    cobrados: safeCobrados,
                    pendientes: safePendientes,
                },
            ],
            domainMax: Math.max(safeTotal, safeCobrados + safePendientes, 1),
        };
    }, [total, cobrados, pendientes]);

    const chartConfig: ChartConfig = useMemo(
        () => ({
            cobrados: {
                label: "Cobrados",
                color: COLOR.GRAPHICS.PRIMARY,
            },
            pendientes: {
                label: "Por cobrar",
                color: COLOR.GRAPHICS.QUATERNARY,
            },
        }),
        []
    );

    const totalLabel = (chartData[0]?.total ?? 0) as number;

    return (
        <ChartContainer
            config={chartConfig}
            className={className ?? "w-full max-h-[240px]"}
        >
            <RadialBarChart
                data={chartData}
                startAngle={90}
                endAngle={-270}
                innerRadius="70%"
                outerRadius="90%"
            >
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />

                <PolarAngleAxis
                    type="number"
                    domain={[0, domainMax]}
                    dataKey="total"
                    tick={false}
                    axisLine={false}
                />

                <RadialBar
                    key="pendientes"
                    dataKey="pendientes"
                    stackId="a"
                    fill="var(--color-pendientes)"
                    cornerRadius={5}
                >
                </RadialBar>
                <RadialBar
                    key="cobrados"
                    dataKey="cobrados"
                    stackId="a"
                    fill="var(--color-cobrados)"
                    cornerRadius={5}
                >
                </RadialBar>

                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: COLOR.TEXT.PRIMARY }}
                >
                    <tspan
                        x="50%"
                        dy="-0.2em"
                        style={{ fontSize: 28, fontWeight: 700 }}
                    >
                        {totalLabel.toLocaleString()}
                    </tspan>
                    <tspan
                        x="50%"
                        dy="2em"
                        style={{ fontSize: 12, fill: COLOR.TEXT.SECONDARY }}
                    >
                        Total
                    </tspan>
                </text>

                <ChartLegend
                    content={<ChartLegendContent />}
                />
            </RadialBarChart>
        </ChartContainer>
    );
}
