import React, { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { getStyles } from "./DesglosePieChart.styles";
import DesglosePieChartItem from "./DesglosePieChartItem";

export type DesglosePieChartListProps = {
    topItems: any[];
    otrosItem?: any;
    maxMonto: number;
    isMobile: boolean;
    showListOnMobile: boolean;
    setShowListOnMobile: (val: boolean) => void;
    effectivelyExpanded: boolean;
};

export default function DesglosePieChartList({
    topItems,
    otrosItem,
    maxMonto,
    isMobile,
    showListOnMobile,
    setShowListOnMobile,
    effectivelyExpanded,
}: DesglosePieChartListProps) {
    const styles = useMemo(() => getStyles(isMobile), [isMobile]);

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

            <div style={listContainerStyle}>
                <div style={styles.listInner}>
                    <div style={styles.listSpace}>
                        {topItems.map((item) => (
                            <DesglosePieChartItem
                                key={item.key}
                                label={item.label}
                                monto={item.monto}
                                porcentaje={item.porcentaje}
                                fill={item.fill}
                                maxMonto={maxMonto}
                                isMobile={isMobile}
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
                                            isMobile={isMobile}
                                        />
                                    </div>
                                </div>

                                <div style={otrosSubItemsStyle}>
                                    <div style={styles.listInner}>
                                        <div style={styles.subItemsContainer}>
                                            {otrosItem.subItems?.map((sub: any, idx: number) => (
                                                <DesglosePieChartItem
                                                    key={`${otrosItem.key}_sub_${idx}`}
                                                    label={sub.label}
                                                    monto={sub.monto}
                                                    porcentaje={sub.porcentaje}
                                                    fill={sub.fill}
                                                    maxMonto={maxMonto}
                                                    isSubItem={true}
                                                    isMobile={isMobile}
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
