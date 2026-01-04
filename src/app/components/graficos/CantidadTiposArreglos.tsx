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

type Props = {
    items?: Array<{
        tipo: string;
        cantidad: number;
        ingresos: number;
    }>;
};

export default function CantidadTiposArreglos({
    items,
}: Props) {
    function TiposTooltip({
        active,
        payload,
    }: {
        active?: boolean;
        payload?: Array<{
            payload?: {
                tipo?: unknown;
                cantidad?: unknown;
                ingresos?: unknown;
            } & Record<string, unknown>;
        }>;
    }) {
        if (!active || !payload?.length) return null;

        const p = payload[0]?.payload;
        const tipo = String(p?.tipo ?? "");
        const cantidad = Number(p?.cantidad ?? 0);
        const ingresos = Number(p?.ingresos ?? 0);

        if (!tipo) return null;

        return (
            <div className="border-border/50 bg-background min-w-[12rem] rounded-lg border px-3 py-2 text-xs shadow-xl">
                <div className="text-foreground mb-1 text-sm font-semibold">
                    {tipo}
                </div>
                <div className="text-muted-foreground">
                    Cantidad:{" "}
                    <span className="text-foreground font-medium">
                        {formatNumberAr(cantidad, { maxDecimals: 0, minDecimals: 0 })}
                    </span>
                </div>
                <div className="text-muted-foreground">
                    Ingresos:{" "}
                    <span className="text-foreground font-medium">
                        $
                        {formatNumberAr(ingresos, { maxDecimals: 2, minDecimals: 2 })}
                    </span>
                </div>
            </div>
        );
    }

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
                        <TiposTooltip />
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
