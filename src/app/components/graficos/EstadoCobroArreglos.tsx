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
    const { chartData, totalLabel } = useMemo(() => {
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
                { key: "cobrados", name: "Cobrados", value: safeCobrados },
                {
                    key: "pendientes",
                    name: "Por cobrar",
                    value: safePendientes,
                },
            ],
            totalLabel: safeTotal,
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
                color: COLOR.GRAPHICS.QUINARY,
            },
        }),
        []
    );

    return (
        <div style={{ width: "100%" }}>
            <ChartContainer
                config={chartConfig}
                className={className ?? "w-full "}
            >
                <PieChart>
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent
                                indicator="dot"
                                nameKey="key"
                            />
                        }
                    />

                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="68%"
                        outerRadius="88%"
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        stroke="transparent"
                        label
                        labelLine={false}
                    >
                        {chartData.map((entry) => (
                            <Cell
                                key={entry.key}
                                fill={`var(--color-${entry.key})`}
                            />
                        ))}
                    </Pie>

                    <text
                        x="50%"
                        y="45%"
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
                            dy="10%"
                            style={{
                                fontSize: 12,
                                fill: COLOR.TEXT.SECONDARY,
                            }}
                        >
                            Total
                        </tspan>
                    </text>
                <ChartLegend
                    content={<ChartLegendContent nameKey="key" />}
                />
                </PieChart>
            </ChartContainer>

        </div>
    );
}
