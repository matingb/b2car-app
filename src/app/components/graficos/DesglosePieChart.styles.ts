import React from "react";

export const getStyles = (isMobile: boolean): Record<string, React.CSSProperties> => ({
    container: {
        width: "100%",
        marginTop: "1rem",
        display: "flex",
        flexDirection: "column",
    },
    row: {
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "stretch",
        gap: "1rem",
        width: "100%",
    },
    chartWrapper: {
        height: "12rem",
        width: "12rem",
        flexShrink: 0,
        margin: isMobile ? "0 auto" : "0",
    },
    chartContainer: {
        width: "100%",
        height: "100%",
        aspectRatio: "1 / 1",
    },
    listWrapper: {
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    mobileToggleContainer: {
        display: isMobile ? "flex" : "none",
        justifyContent: "center",
        marginBottom: "0.5rem",
    },
    mobileToggleButton: {
        color: "#94a3b8", // slate-400
        padding: "0.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "9999px",
        transition: "color 0.3s, background-color 0.3s",
        border: "none",
        background: "transparent",
        cursor: "pointer",
    },
    mobileToggleButtonHover: {
        backgroundColor: "#f1f5f9", // hover:bg-slate-100
        color: "#475569", // hover:text-slate-600
    },
    expandIcon: {
        width: "1.5rem",
        height: "1.5rem",
        transition: "transform 0.3s",
    },
    listContainer: {
        display: "grid",
        transition: "grid-template-rows 0.3s ease-in-out, opacity 0.3s ease-in-out",
    },
    listInner: {
        overflow: "hidden",
    },
    listSpace: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem", // space-y-3
        paddingBottom: isMobile ? "0.5rem" : "0",
        paddingTop: isMobile ? "0.25rem" : "0",
    },
    itemContainer: {
        display: "flex",
        flexDirection: "column",
        fontSize: "0.875rem", // text-sm
    },
    itemHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "0.375rem", // mb-1.5
    },
    itemLabelPrimary: {
        fontWeight: 500, // font-medium
        color: "#334155", // slate-700
    },
    itemLabelSecondary: {
        fontWeight: 500, // font-medium
        color: "#475569", // slate-600
    },
    itemValues: {
        textAlign: "right",
    },
    itemMonto: {
        fontWeight: 700, // font-bold
        color: "#0f172a", // slate-900
    },
    itemPorcentaje: {
        color: "#94a3b8", // slate-400
        fontSize: "0.75rem", // text-xs
        marginLeft: "0.5rem",
        width: "2.5rem", // w-10
        display: "inline-block",
        textAlign: "right",
    },
    barBackground: {
        width: "100%",
        backgroundColor: "#f1f5f9", // slate-100
        borderRadius: "9999px",
        height: "0.375rem", // h-1.5
        overflow: "hidden",
    },
    barForeground: {
        height: "100%",
        borderRadius: "9999px",
        transition: "width 0.5s, background-color 0.5s",
    },
    otrosContainer: {
        position: "relative",
    },
    subItemsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem", // space-y-3
        paddingTop: "0.25rem", // pt-1
    },
    otrosToggleContainer: {
        display: isMobile ? "none" : "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "1rem",
        width: "100%",
        marginTop: "0.5rem",
    },
    otrosToggleSpacer: {
        width: "12rem", // w-48
        flexShrink: 0,
        margin: "0",
        pointerEvents: "none",
    },
    otrosToggleInner: {
        flex: 1,
        display: "flex",
        justifyContent: "center",
    },
    otrosToggleButton: {
        color: "#94a3b8", // slate-400
        padding: "0.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.3s",
        border: "none",
        background: "transparent",
        cursor: "pointer",
    },
    emptyState: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "12rem",
        fontSize: "0.875rem",
        color: "#64748b", // slate-500
    },
});
