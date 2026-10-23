"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/app/components/shadcn/ui/chart";
import GraficoTooltip from "./GraficoTooltip";
import ScrollableChart from "./ScrollableChart";
import type { Granularity } from "@/lib/dashboard/aggregation";
import type { CardChartConfig } from "@/lib/dashboard/cards";
import { formatArs, formatNumberAr } from "@/lib/format";

type ComparedPeriod = {
    id: string;
    label: string;
    color: string;
    buckets: Array<{ key: string; label: string } & object>;
};

type Props = {
    id: string;
    periods: ComparedPeriod[];
    granularity: Granularity;
    chart: CardChartConfig;
};

type Category = Record<string, unknown> & {
    id: string;
    label: string;
    fill: string;
    total: number;
};

/**
 * Varios períodos en una misma línea de tiempo: una barra por bucket y por período, en orden
 * cronológico, con el color del período. El desglose del bucket queda en el tooltip.
 */
export default function GraficoComparacion({ id, periods, granularity, chart }: Props) {
    const formatValue = useMemo(
        () =>
            chart.valueFormat === "currency"
                ? (v: number) => formatArs(v, { maxDecimals: 0 })
                : (v: number) => formatNumberAr(v, { maxDecimals: 0 }),
        [chart.valueFormat],
    );

    const { data, tooltipRows } = useMemo(() => {
        const categories: Array<Category & { order: number; key: string }> = periods.flatMap((period, order) =>
            period.buckets.map((bucket) => {
                const values = bucket as unknown as Record<string, number>;
                return {
                    ...values,
                    id: `${period.id}|${bucket.key}`,
                    key: bucket.key,
                    order,
                    label: bucket.label,
                    titulo: `${period.label} · ${bucket.label}`,
                    fill: period.color,
                    total: chart.total(values),
                };
            }),
        );
        categories.sort((a, b) => (a.key === b.key ? a.order - b.order : a.key < b.key ? -1 : 1));

        const rows = [
            ...chart.parts.map((part) => ({
                key: part.key,
                label: part.label,
                formatter: (value: unknown) => formatValue(Number(value ?? 0)),
            })),
            { key: "total", label: chart.totalLabel, formatter: (value: unknown) => formatValue(Number(value ?? 0)) },
        ];

        return { data: categories, tooltipRows: rows };
    }, [chart, formatValue, periods]);

    const labelById = useMemo(() => new Map(data.map((d) => [d.id, d.label])), [data]);
    const config: ChartConfig = { total: { label: chart.totalLabel } };

    return (
        <ScrollableChart categories={data.length} granularity={granularity}>
            <ChartContainer id={id} config={config} className="w-full h-[220px]">
                <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="id"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval="preserveStartEnd"
                        tickFormatter={(value: string) => labelById.get(value) ?? ""}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={chart.valueFormat === "currency" ? 64 : 28}
                        allowDecimals={false}
                        tickFormatter={(v: number) =>
                            chart.valueFormat === "currency" ? `$${(v / 1000).toFixed(0)}k` : String(v)
                        }
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<GraficoTooltip titleKey="titulo" extraRows={tooltipRows} />}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                        {data.map((entry) => (
                            <Cell key={entry.id} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>
        </ScrollableChart>
    );
}
