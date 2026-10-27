import React, { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { getStyles } from "./DesglosePieChart.styles";
import DesglosePieChartItem from "./DesglosePieChartItem";
import type { DesglosePieChartDataItem } from "./DesglosePieChart";

export type DesglosePieChartListProps = {
    topItems: DesglosePieChartDataItem[];
    otrosItem?: DesglosePieChartDataItem;
    maxMonto: number;
    isCompact: boolean;
    isMobile: boolean;
    showListOnMobile: boolean;
    setShowListOnMobile: (val: boolean) => void;
    effectivelyExpanded: boolean;
    valueFormatter?: (value: number) => string;
    percentageFormatter?: (value: number) => string;
    barScale?: "maximum" | "percentageOfTotal";
    maxListHeight?: number;
    listAccessibleLabel?: string;
    wrapLabels?: boolean;
};

export default function DesglosePieChartList({
    topItems,
    otrosItem,
    maxMonto,
    isCompact,
    isMobile,
    showListOnMobile,
    setShowListOnMobile,
    effectivelyExpanded,
    valueFormatter,
    percentageFormatter,
    barScale,
    maxListHeight,
    listAccessibleLabel,
    wrapLabels,
}: DesglosePieChartListProps) {
    const styles = useMemo(
        () => getStyles(isCompact, { isMobile, wrapLabels }),
        [isCompact, isMobile, wrapLabels]
    );

    // Handle inline CSS for transition grid
    const listContainerStyle = {
        ...styles.listContainer,
        gridTemplateRows: showListOnMobile || !isMobile ? "1fr" : "0fr",
        opacity: showListOnMobile || !isMobile ? 1 : 0,
    };

    const otrosHeaderStyle = {
        ...styles.listContainer,
        gridTemplateRows: effectivelyExpanded ? "0fr" : "1fr",
        opacity: effectivelyExpanded ? 0 : 1,
        marginTop: effectivelyExpanded ? "0" : "auto",
    };

    const otrosSubItemsStyle = {
        ...styles.listContainer,
        gridTemplateRows: effectivelyExpanded ? "1fr" : "0fr",
        opacity: effectivelyExpanded ? 1 : 0,
    };

    return (
        <div style={styles.listWrapper}>
            <div style={styles.mobileToggleContainer}>
                <button
                    onClick={() => setShowListOnMobile(!showListOnMobile)}
                    style={styles.mobileToggleButton}
                    aria-label={showListOnMobile ? "Ocultar desglose" : "Ver desglose"}
                >
                    <ChevronDown
                        style={{
                            ...styles.expandIcon,
                            transform: showListOnMobile ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                    />
                </button>
            </div>

            <div data-testid="desglose-list-container" style={listContainerStyle}>
                <div style={styles.listInner}>
                    <div
                        style={{
                            ...styles.listSpace,
                            ...(maxListHeight ? { maxHeight: maxListHeight, overflowY: "auto" } : {}),
                        }}
                        tabIndex={maxListHeight ? 0 : undefined}
                        aria-label={listAccessibleLabel}
                    >
                        {topItems.map((item) => (
                            <DesglosePieChartItem
                                key={item.key}
                                label={item.label}
                                monto={item.monto}
                                porcentaje={item.porcentaje}
                                fill={item.fill}
                                maxMonto={maxMonto}
                                isCompact={isCompact}
                                isMobile={isMobile}
                                valueFormatter={valueFormatter}
                                percentageFormatter={percentageFormatter}
                                barScale={barScale}
                                itemKey={item.key}
                                wrapLabels={wrapLabels}
                            />
                        ))}

                        {otrosItem && (
                            <div style={styles.otrosContainer}>
                                <div style={otrosHeaderStyle}>
                                    <div style={styles.listInner}>
                                        <DesglosePieChartItem
                                            key={otrosItem.key}
                                            label={otrosItem.label}
                                            monto={otrosItem.monto}
                                            porcentaje={otrosItem.porcentaje}
                                            fill={otrosItem.fill}
                                            maxMonto={maxMonto}
                                            isCompact={isCompact}
                                            isMobile={isMobile}
                                            valueFormatter={valueFormatter}
                                            percentageFormatter={percentageFormatter}
                                            barScale={barScale}
                                            itemKey={otrosItem.key}
                                            wrapLabels={wrapLabels}
                                        />
                                    </div>
                                </div>

                                <div style={otrosSubItemsStyle}>
                                    <div style={styles.listInner}>
                                        <div style={styles.subItemsContainer}>
                                            {otrosItem.subItems?.map((sub, idx) => (
                                                <DesglosePieChartItem
                                                    key={`${otrosItem.key}_sub_${idx}`}
                                                    label={sub.label}
                                                    monto={sub.monto}
                                                    porcentaje={sub.porcentaje}
                                                    fill={sub.fill}
                                                    maxMonto={maxMonto}
                                                    isSubItem={true}
                                                    isCompact={isCompact}
                                                    isMobile={isMobile}
                                                    valueFormatter={valueFormatter}
                                                    percentageFormatter={percentageFormatter}
                                                    barScale={barScale}
                                                    itemKey={sub.key}
                                                    wrapLabels={wrapLabels}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
