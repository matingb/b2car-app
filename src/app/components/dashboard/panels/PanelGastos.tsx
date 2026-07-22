/** @jsxImportSource @emotion/react */
"use client";

import React from "react";
import { css } from "@emotion/react";
import GraficoGastos from "@/app/components/graficos/GraficoGastos";
import DesglosePieChart from "@/app/components/graficos/DesglosePieChart";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    gastosData: Array<{ label: string; repuestos: number; sueldos: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelGastos({ gastosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Evolución de Gastos" headerAction={headerAction}>
                <GraficoGastos data={gastosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div css={styles.mainPanel}>
                    <div css={styles.halfPanel}>
                        <h4 css={styles.subTitle}>Costo por tipo</h4>
                        <div css={styles.chartWrapper}>
                            <DesglosePieChart items={stats?.costoPorTipo} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                    <div css={styles.halfPanel}>
                        <h4 css={styles.subTitle}>Costo por empleado</h4>
                        <div css={styles.chartWrapper}>
                            <DesglosePieChart items={stats?.costoPorEmpleado} montoLabel="Costo" variant="danger" />
                        </div>
                    </div>
                </div>
            </DashboardSectionCard>
        </div>
    );
}

const styles = {
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 8,
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
    subTitle: css({
        fontSize: 15,
        fontWeight: 600,
        marginBottom: 8,
        color: COLOR.TEXT.SECONDARY,
    }),
};
