"use client";

import React, { useMemo } from "react";
import { COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Cell, Pie, PieChart } from "recharts";
import { formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";

export type DesgloseItem = {
    label: string;
    cantidad: number;
    monto: number;
};

type Props = {
    items?: DesgloseItem[];
    montoLabel?: string;
    variant?: "default" | "danger";
};

const DEFAULT_COLORS = [
    COLOR.GRAPHICS.PRIMARY,
    COLOR.GRAPHICS.SECONDARY,
    COLOR.GRAPHICS.TERTIARY,
    COLOR.GRAPHICS.QUATERNARY,
    COLOR.GRAPHICS.QUINARY,
];

const DANGER_COLORS = [
    COLOR.GRAPHICS_DANGER.PRIMARY,
    COLOR.GRAPHICS_DANGER.SECONDARY,
    COLOR.GRAPHICS_DANGER.TERTIARY,
    COLOR.GRAPHICS_DANGER.QUATERNARY,
    COLOR.GRAPHICS_DANGER.QUINARY,
];

export default function DesglosePieChart({ items, montoLabel = "Monto", variant = "default" }: Props) {
    const extraRows = useMemo(
        () => [
            {
                key: "cantidad",
                label: "Cantidad",
                formatter: (v: unknown) => formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 }),
            },
            {
                key: "monto",
                label: montoLabel,
                formatter: (v: unknown) => `$${formatNumberAr(Number(v ?? 0), { maxDecimals: 0, minDecimals: 0 })}`,
            },
            {
                key: "porcentaje",
                label: "Porcentaje",
                formatter: (v: unknown) => `${formatNumberAr(Number(v ?? 0), { maxDecimals: 1, minDecimals: 0 })}%`,
            },
        ],
        [montoLabel]
    );

    const series = useMemo(() => {
        const safeItems = (items ?? []).filter((i) => i && typeof i.label === "string");
        const total = safeItems.reduce((acc, item) => acc + Number(item?.monto ?? 0), 0);
        const keys = safeItems.map((_, idx) => `linea_${idx}`);
        const colors = variant === "danger" ? DANGER_COLORS : DEFAULT_COLORS;

        const data = keys.map((key, idx) => {
            const item = safeItems[idx];
            const monto = Number(item?.monto ?? 0);
            const porcentaje = total > 0 ? (monto / total) * 100 : 0;
            return {
                key,
                label: item?.label ?? key,
                cantidad: Number(item?.cantidad ?? 0),
                monto,
                porcentaje,
                fill: colors[idx % colors.length],
            };
        });

        const config: ChartConfig = {};
        keys.forEach((key, idx) => {
            config[key] = {
                label: safeItems[idx]?.label ?? key,
                color: colors[idx % colors.length],
            };
        });

        return { config, data, total };
    }, [items, variant]);

    const maxMonto = useMemo(() => {
        return Math.max(0, ...series.data.map(d => d.monto));
    }, [series.data]);

    if (!series.data.length) {
        return (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">
                Sin datos
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-8 w-full mt-4">
            <div className="h-48 w-48 shrink-0">
                <ChartContainer config={series.config} className="w-full h-full aspect-square">
                    <PieChart>
                        <ChartTooltip cursor={false} content={<GraficoTooltip titleKey="label" extraRows={extraRows} />} />
                        <Pie
                            data={series.data}
                            dataKey="monto"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            isAnimationActive={true}
                            animationDuration={1000}
                            innerRadius={40}
                            outerRadius={90}
                            paddingAngle={2}
                            stroke="none"
                        >
                            {series.data.map((entry) => (
                                <Cell key={entry.key} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </div>
            
            <div className="flex-1 w-full space-y-3">
                {series.data.map((item) => {
                    const barWidth = maxMonto > 0 ? (item.monto / maxMonto) * 100 : 0;
                    return (
                        <div key={item.key} className="flex flex-col text-sm">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-medium text-slate-700">{item.label}</span>
                                <div className="text-right">
                                    <span className="font-bold text-slate-900">${formatNumberAr(item.monto, { maxDecimals: 0 })}</span>
                                    <span className="text-slate-400 text-xs ml-2 w-10 inline-block text-right">{item.porcentaje.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${barWidth}%`, backgroundColor: item.fill }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
