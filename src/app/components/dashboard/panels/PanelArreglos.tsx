/** @jsxImportSource @emotion/react */
"use client";

import React from "react";
import { css } from "@emotion/react";
import GraficoArreglos from "@/app/components/graficos/GraficoArreglos";
import CantidadTiposArreglos from "@/app/components/graficos/CantidadTiposArreglos";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import DashboardSectionCard from "@/app/components/dashboard/DashboardSectionCard";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { DashboardStats } from "@/app/providers/DashboardProvider";
import type { Granularity } from "@/lib/dashboard/aggregation";

type Props = {
    arreglosData: Array<{ label: string; cantidad: number }>;
    granularity: Granularity;
    stats: DashboardStats | null;
    headerAction?: React.ReactNode;
};

export default function PanelArreglos({ arreglosData, granularity, stats, headerAction }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardSectionCard title="Arreglos realizados" headerAction={headerAction}>
                <GraficoArreglos data={arreglosData} granularity={granularity} />
            </DashboardSectionCard>

            <DashboardSectionCard>
                <div css={styles.mainPanel}>
                    <div css={styles.halfPanel}>
                        <h4 css={styles.subTitle}>Arreglos por tipo</h4>
                        <div css={styles.chartWrapper}>
                            <CantidadTiposArreglos
                                items={(stats?.facturacionPorTipo ?? []).map((d) => ({
                                    tipo: d.label,
                                    cantidad: d.cantidad,
                                    ingresos: d.monto,
                                }))}
                            />
                        </div>
                    </div>
                    <div css={styles.halfPanel}>
                        <h4 css={styles.subTitle}>Estado de pago</h4>
                        <div css={styles.chartWrapper}>
                            <EstadoCobroArreglos
                                total={stats?.totals?.arreglos ?? null}
                                cobrados={stats?.arreglos?.cobrados ?? null}
                                pendientes={stats?.arreglos?.pendientes ?? null}
                            />
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
