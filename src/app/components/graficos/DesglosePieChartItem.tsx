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
    isMobile?: boolean;
};

export default function DesglosePieChartItem({
    label,
    monto,
    porcentaje,
    fill,
    maxMonto,
    isSubItem = false,
    isMobile = false,
}: DesglosePieChartItemProps) {
    const styles = useMemo(() => getStyles(isMobile), [isMobile]);
    const barWidth = maxMonto > 0 ? (monto / maxMonto) * 100 : 0;

    return (
        <div style={styles.itemContainer}>
            <div style={styles.itemHeader}>
                <span style={isSubItem ? styles.itemLabelSecondary : styles.itemLabelPrimary}>
                    {label}
                </span>
                <div style={styles.itemValues}>
                    <span style={styles.itemMonto}>
                        ${formatNumberAr(monto, { maxDecimals: 0 })}
                    </span>
                    <span style={styles.itemPorcentaje}>
                        {porcentaje.toFixed(1)}%
                    </span>
                </div>
            </div>
            <div style={styles.barBackground}>
                <div
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
