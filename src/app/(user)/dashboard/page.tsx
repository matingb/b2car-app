"use client";

import React, { useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import { CircleDollarSign, Scale, TrendingDown, Wrench } from "lucide-react";
import DashboardMetricCard from "@/app/components/dashboard/DashboardMetricCard";
import DashboardExpandablePanel from "@/app/components/dashboard/DashboardExpandablePanel";
import PeriodSelector from "@/app/components/dashboard/PeriodSelector";
import GranularitySelector from "@/app/components/dashboard/GranularitySelector";
import RecentActivityCard from "@/app/components/dashboard/RecentActivityCard";
import { useDashboardControls, ACTIVE_CARDS, type ActiveCard } from "@/app/hooks/dashboard/useDashboardControls";
import PanelFacturacion from "@/app/components/dashboard/panels/PanelFacturacion";
import PanelGastos from "@/app/components/dashboard/panels/PanelGastos";
import PanelArreglos from "@/app/components/dashboard/panels/PanelArreglos";
import PanelBalance from "@/app/components/dashboard/panels/PanelBalance";

export default function DashboardPage() {
    const {
        stats, loading, error,
        period, handlePeriodChange,
        granularity, setGranularity,
        arreglosData, ingresosData, gastosData,
        ingresosBalanceData, gastosBalanceData,
        balanceValue, balanceColor,
    } = useDashboardControls();

    const [activeCard, setActiveCard] = useState<ActiveCard>("facturacion");

    function makeGranularitySelector(card: ActiveCard) {
        return (
            <GranularitySelector
                value={granularity[card]}
                onChange={(g) => setGranularity((prev) => ({ ...prev, [card]: g }))}
            />
        );
    }

    return (
        <div>
            <div css={styles.headerRow}>
                <ScreenHeader title="Dashboard" />
                <PeriodSelector value={period} onChange={handlePeriodChange} />
            </div>

            {/* 4 cards de métricas de negocio */}
            <div css={styles.cardGrid}>
                <DashboardMetricCard
                    titleText="Arreglos realizados"
                    value={stats?.totals?.arreglosEsteMes}
                    icon={<Wrench size={20} color={COLOR.ACCENT.PRIMARY} />}
                    isActive={activeCard === "arreglos"}
                    onClick={() => setActiveCard("arreglos")}
                />
                <DashboardMetricCard
                    titleText="Facturación"
                    value={stats?.totals?.montoIngresos}
                    prefix="$"
                    icon={<CircleDollarSign size={20} color={COLOR.ACCENT.PRIMARY} />}
                    isActive={activeCard === "facturacion"}
                    onClick={() => setActiveCard("facturacion")}
                />
                <DashboardMetricCard
                    titleText="Gastos"
                    value={stats?.totals?.gastos}
                    prefix="$"
                    icon={<TrendingDown size={20} color={COLOR.SEMANTIC.DANGER} />}
                    isActive={activeCard === "gastos"}
                    onClick={() => setActiveCard("gastos")}
                    valueColor={COLOR.SEMANTIC.DANGER}
                />
                <DashboardMetricCard
                    titleText="Balance"
                    value={balanceValue}
                    prefix="$"
                    icon={<Scale size={20} color={balanceColor} />}
                    isActive={activeCard === "balance"}
                    onClick={() => setActiveCard("balance")}
                    valueColor={balanceColor}
                />
            </div>

            {/* Panel expandible según la card seleccionada */}
            <div style={{ marginTop: 12 }}>
                {ACTIVE_CARDS.map((card) => (
                    <DashboardExpandablePanel
                        key={card}
                        isOpen={activeCard === card}
                    >
                        {loading ? (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        ) : error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>{error}</div>
                        ) : card === "arreglos" ? (
                            <PanelArreglos
                                arreglosData={arreglosData}
                                granularity={granularity.arreglos}
                                stats={stats}
                                headerAction={makeGranularitySelector(card)}
                            />
                        ) : card === "facturacion" ? (
                            <PanelFacturacion
                                ingresosData={ingresosData}
                                granularity={granularity.facturacion}
                                stats={stats}
                                headerAction={makeGranularitySelector(card)}
                            />
                        ) : card === "gastos" ? (
                            <PanelGastos
                                gastosData={gastosData}
                                granularity={granularity.gastos}
                                stats={stats}
                                headerAction={makeGranularitySelector(card)}
                            />
                        ) : (
                            <PanelBalance
                                ingresosBalanceData={ingresosBalanceData}
                                gastosBalanceData={gastosBalanceData}
                                granularity={granularity.balance}
                                headerAction={makeGranularitySelector(card)}
                            />
                        )}
                    </DashboardExpandablePanel>
                ))}
            </div>

            <div style={styles.activityPanel}>
                <div style={{ width: "100%" }}>
                    <h3 css={styles.title}>Actividad Reciente</h3>
                    <div style={styles.activityList}>
                        {(stats?.recentActivities ?? []).map((activity) => (
                            <RecentActivityCard key={activity.id} activity={activity} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    headerRow: css({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
    }),
    cardGrid: css({
        display: "grid",
        gap: 12,
        marginTop: 16,
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        },
    }),
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 24,
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            flexDirection: "column",
        },
    }),
    halfPanel: css({
        width: "50%",
        display: "flex",
        flexDirection: "column",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            width: "100%",
        },
    }),
    chartWrapper: css({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    }),
    activityPanel: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        marginTop: 24,
    },
    activityList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    title: css({
        fontSize: 20,
        fontWeight: 600,
        marginBottom: 8,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            fontSize: 18,
        },
    }),
    subTitle: css({
        fontSize: 15,
        fontWeight: 600,
        marginBottom: 8,
        color: COLOR.TEXT.SECONDARY,
    }),
    divider: css({
        height: 1,
        background: COLOR.BORDER.SUBTLE,
        margin: "18px 0",
    }),
} as const;
