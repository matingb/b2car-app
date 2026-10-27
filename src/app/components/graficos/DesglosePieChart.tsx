"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import {
    ChartContainer,
    ChartTooltip,
    type ChartConfig,
} from "@/app/components/shadcn/ui/chart";
import { Cell, Pie, PieChart } from "recharts";
import { formatNumberAr } from "@/lib/format";
import GraficoTooltip from "./GraficoTooltip";
import { ChevronDown } from "lucide-react";
import { getStyles } from "./DesglosePieChart.styles";
import DesglosePieChartList from "./DesglosePieChartList";

export type DesgloseItem = {
    label: string;
    cantidad: number;
    monto: number;
    fill?: string;
    /** Identidad estable para separar filas con etiquetas iguales, como empleados homónimos. */
    identityKey?: string;
};

export type DesglosePieChartSubItem = DesgloseItem & {
    key: string;
    porcentaje: number;
    fill: string;
};

export type DesglosePieChartDataItem = DesglosePieChartSubItem & {
    subItems?: DesglosePieChartSubItem[];
};

type Props = {
    id?: string;
    items?: DesgloseItem[];
    montoLabel?: string;
    variant?: "default" | "danger";
    maxItems?: number;
    groupRest?: boolean;
    showCountInTooltip?: boolean;
    percentageDecimals?: 0 | 1;
    valueFormatter?: (value: number) => string;
    percentageFormatter?: (value: number) => string;
    percentageTotal?: number;
    centerTotal?: number;
    centerLabel?: string;
    barScale?: "maximum" | "percentageOfTotal";
    showListOnMobileInitially?: boolean;
    maxListHeight?: number;
    listAccessibleLabel?: string;
    sortLabelOnTies?: boolean;
    emptyText?: string;
    adaptivePaddingAngle?: boolean;
    allowTooltipEscape?: boolean;
    wrapLabels?: boolean;
    containerResponsiveLayout?: boolean;
};

const DEFAULT_COLORS = [
    COLOR.GRAPHICS.PRIMARY,
    COLOR.GRAPHICS.SECONDARY,
    COLOR.GRAPHICS.TERTIARY,
    COLOR.GRAPHICS.QUATERNARY,
    COLOR.GRAPHICS.QUINARY,
    COLOR.GRAPHICS.SENARY,
    COLOR.GRAPHICS.SEPTENARY,
    COLOR.GRAPHICS.OCTONARY,
    COLOR.GRAPHICS.NONARY,
    COLOR.GRAPHICS.DENARY,
];

const DANGER_COLORS = [
    COLOR.GRAPHICS_DANGER.PRIMARY,
    COLOR.GRAPHICS_DANGER.SECONDARY,
    COLOR.GRAPHICS_DANGER.TERTIARY,
    COLOR.GRAPHICS_DANGER.QUATERNARY,
    COLOR.GRAPHICS_DANGER.QUINARY,
    COLOR.GRAPHICS_DANGER.SENARY,
    COLOR.GRAPHICS_DANGER.SEPTENARY,
    COLOR.GRAPHICS_DANGER.OCTONARY,
    COLOR.GRAPHICS_DANGER.NONARY,
    COLOR.GRAPHICS_DANGER.DENARY,
];

function getDistributedColor(idx: number, totalItems: number, palette: string[]) {
    if (totalItems <= 1) return palette[0];

    if (totalItems <= 5) {
        return palette[idx * 2];
    }
    const mappedIdx = Math.round((idx / (totalItems - 1)) * (palette.length - 1));
    return palette[mappedIdx];
}

function compareText(a: string, b: string) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function defaultValueFormatter(value: number) {
    return `$${formatNumberAr(value, { maxDecimals: 0 })}`;
}

function defaultPercentageFormatter(value: number) {
    return `${value.toFixed(1)}%`;
}

export default function DesglosePieChart({
    id = "desglose-pie",
    items,
    montoLabel = "Monto",
    variant = "default",
    maxItems = 5,
    groupRest = true,
    showCountInTooltip = true,
    percentageDecimals = 0,
    valueFormatter = defaultValueFormatter,
    percentageFormatter = defaultPercentageFormatter,
    percentageTotal,
    centerTotal,
    centerLabel,
    barScale = "maximum",
    showListOnMobileInitially = false,
    maxListHeight,
    listAccessibleLabel,
    sortLabelOnTies = false,
    emptyText = "Sin datos",
    adaptivePaddingAngle = false,
    allowTooltipEscape = false,
    wrapLabels = false,
    containerResponsiveLayout = false,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [showListOnMobile, setShowListOnMobile] = useState(showListOnMobileInitially);
    const [expandedOtros, setExpandedOtros] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 640;
            setIsMobile(mobile);
            if (!containerResponsiveLayout) setIsCompact(mobile);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, [containerResponsiveLayout]);

    useEffect(() => {
        if (!containerResponsiveLayout) return;
        const container = containerRef.current;
        if (!container) return;

        const updateCompactLayout = () => {
            setIsCompact(container.getBoundingClientRect().width < BREAKPOINTS.md);
        };
        updateCompactLayout();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateCompactLayout);
            observer.observe(container);
            return () => observer.disconnect();
        }

        window.addEventListener("resize", updateCompactLayout);
        return () => window.removeEventListener("resize", updateCompactLayout);
    }, [containerResponsiveLayout]);

    const styles = useMemo(
        () => getStyles(isCompact, { hasCenterOverlay: centerTotal !== undefined, isMobile, wrapLabels }),
        [isCompact, isMobile, centerTotal, wrapLabels]
    );
    const effectivelyExpanded = expandedOtros || isMobile;

    const extraRows = useMemo(() => {
        const rows = [];
        if (showCountInTooltip) {
            rows.push({
                key: "cantidad",
                label: "Cantidad",
                formatter: (value: unknown) => formatNumberAr(Number(value ?? 0), { maxDecimals: 0, minDecimals: 0 }),
            });
        }
        rows.push(
            {
                key: "monto",
                label: montoLabel,
                formatter: (value: unknown) => valueFormatter(Number(value ?? 0)),
            },
            {
                key: "porcentaje",
                label: "Porcentaje",
                formatter: (value: unknown) => `${formatNumberAr(Number(value ?? 0), {
                    maxDecimals: 1,
                    minDecimals: percentageDecimals,
                })}%`,
            },
        );
        return rows;
    }, [montoLabel, showCountInTooltip, valueFormatter, percentageDecimals]);

    const series = useMemo(() => {
        const safeItems = (items ?? []).filter((item) => item && typeof item.label === "string");
        const colors = variant === "danger" ? DANGER_COLORS : DEFAULT_COLORS;
        const processedItems = [...safeItems].sort((a, b) => {
            const byValue = b.monto - a.monto;
            if (byValue !== 0 || !sortLabelOnTies) return byValue;
            return compareText(a.label, b.label) || compareText(a.identityKey ?? "", b.identityKey ?? "");
        });
        const total = percentageTotal ?? processedItems.reduce((sum, item) => sum + Number(item.monto ?? 0), 0);

        const itemsWithColor: DesglosePieChartSubItem[] = processedItems.map((item, index) => ({
            ...item,
            key: item.identityKey
                ? `item_${item.identityKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`
                : `linea_${index}`,
            porcentaje: total > 0 ? (item.monto / total) * 100 : 0,
            fill: getDistributedColor(index, processedItems.length, colors),
        }));

        let pieDataItems: DesglosePieChartDataItem[] = [...itemsWithColor];
        if (groupRest && pieDataItems.length > maxItems + 1) {
            const top = pieDataItems.slice(0, maxItems);
            const rest = pieDataItems.slice(maxItems);
            const restMonto = rest.reduce((sum, item) => sum + item.monto, 0);
            const restCantidad = rest.reduce((sum, item) => sum + item.cantidad, 0);

            pieDataItems = [
                ...top,
                {
                    key: "otros",
                    label: "Otros",
                    monto: restMonto,
                    cantidad: restCantidad,
                    porcentaje: total > 0 ? (restMonto / total) * 100 : 0,
                    subItems: rest,
                    fill: "#94a3b8", // Preserve the existing gray for the monetary "Otros" segment.
                },
            ];
        }

        const data = pieDataItems.map((item) => ({ ...item }));
        const config: ChartConfig = {};
        data.forEach((item) => {
            config[item.key] = {
                label: item.label,
                color: item.fill,
            };
        });

        return { config, data };
    }, [items, variant, maxItems, groupRest, percentageTotal, sortLabelOnTies]);

    const maxMonto = useMemo(
        () => Math.max(0, ...series.data.map((item) => item.monto)),
        [series.data]
    );

    if (!series.data.length) {
        return <div style={styles.emptyState}>{emptyText}</div>;
    }

    const hasOtros = series.data.some((item) => item.subItems && item.subItems.length > 0);
    const topItems = series.data.filter((item) => !item.subItems || item.subItems.length === 0);
    const otrosItem = series.data.find((item) => item.subItems && item.subItems.length > 0);
    const pieChartData = effectivelyExpanded && otrosItem?.subItems
        ? [...topItems, ...otrosItem.subItems]
        : series.data;
    const formattedCenterTotal = centerTotal === undefined ? null : valueFormatter(centerTotal);
    const centerFontSize = formattedCenterTotal
        ? Math.max(10, 22 - Math.max(0, formattedCenterTotal.length - 7) * 1.45)
        : undefined;

    return (
        <div ref={containerRef} style={styles.container}>
            <div data-testid="desglose-chart-row" style={styles.row}>
                <div style={styles.chartWrapper}>
                    <ChartContainer
                        id={id}
                        config={series.config}
                        style={{ ...styles.chartContainer, ...(allowTooltipEscape ? { overflow: "visible" } : {}) }}
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<GraficoTooltip titleKey="label" extraRows={extraRows} />}
                                allowEscapeViewBox={allowTooltipEscape ? { x: true, y: true } : undefined}
                                wrapperStyle={allowTooltipEscape ? { zIndex: 10000, overflow: "visible" } : undefined}
                            />
                            <Pie
                                data={pieChartData}
                                dataKey="monto"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                isAnimationActive={true}
                                animationDuration={600}
                                innerRadius={centerTotal === undefined ? 40 : 58}
                                outerRadius={90}
                                paddingAngle={adaptivePaddingAngle ? Math.min(2, 180 / pieChartData.length) : 2}
                                stroke="none"
                            >
                                {pieChartData.map((item) => (
                                    <Cell key={item.key} fill={item.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    {formattedCenterTotal !== null && (
                        <div
                            role="img"
                            style={styles.centerOverlay}
                            aria-label={`${centerLabel ?? "Total"}: ${formattedCenterTotal}`}
                        >
                            <span style={{ ...styles.centerValue, fontSize: centerFontSize }}>{formattedCenterTotal}</span>
                            {centerLabel && <span style={styles.centerLabel}>{centerLabel}</span>}
                        </div>
                    )}
                </div>

                <DesglosePieChartList
                    topItems={topItems}
                    otrosItem={otrosItem}
                    maxMonto={maxMonto}
                    isCompact={isCompact}
                    isMobile={isMobile}
                    showListOnMobile={showListOnMobile}
                    setShowListOnMobile={setShowListOnMobile}
                    effectivelyExpanded={effectivelyExpanded}
                    valueFormatter={valueFormatter}
                    percentageFormatter={percentageFormatter}
                    barScale={barScale}
                    maxListHeight={maxListHeight}
                    listAccessibleLabel={listAccessibleLabel}
                    wrapLabels={wrapLabels}
                />
            </div>

            {hasOtros && (
                <div style={styles.otrosToggleContainer}>
                    <div style={styles.otrosToggleSpacer} />
                    <div style={styles.otrosToggleInner}>
                        <button
                            onClick={() => setExpandedOtros(!expandedOtros)}
                            style={styles.otrosToggleButton}
                            aria-label={expandedOtros ? "Contraer otros" : "Expandir otros"}
                        >
                            <ChevronDown
                                style={{
                                    ...styles.expandIcon,
                                    transform: expandedOtros ? "rotate(180deg)" : "rotate(0deg)",
                                }}
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
