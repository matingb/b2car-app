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
import { Cell, Pie, PieChart } from "recharts";
import { formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";

type Props = {
    items?: Array<{
        tipo: string;
        cantidad: number;
        ingresos: number;
    }>;
};

const TIPOS_EXTRA_ROWS = [
    {
        key: "cantidad",
        label: "Cantidad",
        formatter: (v: unknown) =>
            formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 }),
    },
    {
        key: "ingresos",
        label: "Ingresos",
        formatter: (v: unknown) =>
            `$${formatNumberAr(Number(v ?? 0), { maxDecimals: 2, minDecimals: 2 })}`,
    },
];

export default function CantidadTiposArreglos({
    items,
}: Props) {
    const tipoSeries = useMemo(() => {
        const safeItems = (items ?? []).filter(
            (i) => i && typeof i.tipo === "string"
        );
        const safeTipos = safeItems.map((i) => i.tipo);

        const keys = safeTipos.map((_, idx) => `tipo_${idx}`);

        const data = keys.map((key, idx) => {
            const item = safeItems[idx];
            return {
                key,
                tipo: item?.tipo ?? key,
                cantidad: Number(item?.cantidad ?? 0),
                ingresos: Number(item?.ingresos ?? 0),
            };
        });

        const colors = [
            COLOR.GRAPHICS.PRIMARY,
            COLOR.GRAPHICS.SECONDARY,
            COLOR.GRAPHICS.TERTIARY,
            COLOR.GRAPHICS.QUATERNARY,
            COLOR.GRAPHICS.QUINARY,
        ];


        const config: ChartConfig = {};
        keys.forEach((key, idx) => {
            config[key] = {
                label: safeTipos[idx] ?? key,
                color: colors[idx % colors.length],
            };
        });

        return {
            config,
            data,
        };
    }, [items]);

    return (
        <ChartContainer
            config={tipoSeries.config}
            className="w-full "
        >
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={
                        <GraficoTooltip titleKey="tipo" extraRows={TIPOS_EXTRA_ROWS} />
                    }
                />
                <Pie
                    data={tipoSeries.data}
                    dataKey="cantidad"
                    nameKey="tipo"
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

                <ChartLegend content={<ChartLegendContent nameKey="key"/>} />
            </PieChart>
        </ChartContainer>
    );
}
