import React, { useMemo } from "react";
import { formatNumberAr } from "@/lib/format";
import { getStyles } from "./DesglosePieChart.styles";

export type DesglosePieChartItemProps = {
    label: string;
    monto: number;
    porcentaje: number;
    fill: string;
    maxMonto: number;
    isSubItem?: boolean;
    isCompact?: boolean;
    isMobile?: boolean;
    valueFormatter?: (value: number) => string;
    percentageFormatter?: (value: number) => string;
    barScale?: "maximum" | "percentageOfTotal";
    itemKey?: string;
    wrapLabels?: boolean;
};

export default function DesglosePieChartItem({
    label,
    monto,
    porcentaje,
    fill,
    maxMonto,
    isSubItem = false,
    isCompact = false,
    isMobile = false,
    valueFormatter = (value) => `$${formatNumberAr(value, { maxDecimals: 0 })}`,
    percentageFormatter = (value) => `${value.toFixed(1)}%`,
    barScale = "maximum",
    itemKey,
    wrapLabels = false,
}: DesglosePieChartItemProps) {
    const styles = useMemo(
        () => getStyles(isCompact, { isMobile, wrapLabels }),
        [isCompact, isMobile, wrapLabels]
    );
    const barWidth = barScale === "percentageOfTotal"
        ? porcentaje
        : maxMonto > 0 ? (monto / maxMonto) * 100 : 0;

    return (
        <div style={styles.itemContainer} data-testid="desglose-row" data-chart-key={itemKey}>
            <div style={styles.itemHeader}>
                <span style={isSubItem ? styles.itemLabelSecondary : styles.itemLabelPrimary}>
                    {label}
                </span>
                <div style={styles.itemValues}>
                    <span style={styles.itemMonto}>
                        {valueFormatter(monto)}
                    </span>
                    <span style={styles.itemPorcentaje}>
                        {percentageFormatter(porcentaje)}
                    </span>
                </div>
            </div>
            <div style={styles.barBackground}>
                <div
                    data-testid="desglose-bar"
                    style={{
                        ...styles.barForeground,
                        width: `${barWidth}%`,
                        backgroundColor: fill,
                    }}
                />
            </div>
        </div>
    );
}
