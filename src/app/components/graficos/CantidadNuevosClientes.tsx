"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

type Props = {
    x?: string[];
    values?: Array<number | string | null | undefined>;
    className?: string;
};

type Row = {
    x: string;
    value: number;
};

export default function CantidadNuevosClientes({ x, values, className }: Props) {
    const { data, config } = useMemo(() => {
        const labels = x ?? [];
        const rawValues = values ?? [];

        const len = Math.min(labels.length, rawValues.length);
        const data: Row[] = Array.from({ length: len }).map((_, idx) => ({
            x: labels[idx] ?? "",
            value: Number(rawValues[idx]) || 0,
        }));

        const config: ChartConfig = {
            value: {
                label: "Valor",
                color: COLOR.GRAPHICS.PRIMARY,
            },
        };

        return { data, config };
    }, [x, values]);

    return (
        <ChartContainer
            config={config}
            className={className ?? "w-full h-[150px] sm:h-[200px]"}
        >
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />

                <XAxis
                    dataKey="x"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                />

                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={36}
                />

                <ChartTooltip
                    cursor={false}
                    content={
                        <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={(_, payload) =>
                                payload?.[0]?.payload?.x ?? ""
                            }
                        />
                    }
                />
                <defs>
                    <linearGradient id="value" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="5%"
                            stopColor="var(--color-value)"
                            stopOpacity={1}
                        />Z
                        <stop
                            offset="95%"
                            stopColor="var(--color-value)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                </defs>
                <Area
                    dataKey="value"
                    type="monotone"
                    stroke="var(--color-value)"
                    fill="url(#value)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    dot={false}
                />
            </AreaChart>
        </ChartContainer>
    );
}
