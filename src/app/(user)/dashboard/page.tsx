"use client";

import React from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import { useDashboard } from "@/app/providers/DashboardProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import CantidadTiposArreglos from "@/app/components/graficos/CantidadTiposArreglos";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";

export default function DashboardPage() {
    const { stats, loading, error } = useDashboard();

    return (
        <div>
            <ScreenHeader title="Inicio" />

            <h2>¡Bienvenido a su negocio!</h2>

            <div style={styles.mainPanel}>
                <div style={{ width: "50%" }}>
                    <h3 css={styles.title}>Arreglos | Tipos</h3>
                    <Card>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                marginBottom: 8,
                            }}
                        >
                            {loading ? (
                                <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                    Cargando...
                                </span>
                            ) : null}
                        </div>

                        {error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>
                                {error}
                            </div>
                        ) : null}

                        <CantidadTiposArreglos
                            tipos={stats?.arreglos?.tipos?.tipos}
                            cantidad={stats?.arreglos?.tipos?.cantidad}
                        />
                    </Card>
                </div>

                <div style={{ width: "50%" }}>
                    <h3 css={styles.title}>Arreglos | Estado de pago</h3>
                    <Card>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                marginBottom: 8,
                            }}
                        >
                            
                            {loading ? (
                                <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                    Cargando...
                                </span>
                            ) : null}
                        </div>

                        {error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>
                                {error}
                            </div>
                        ) : null}

                        <EstadoCobroArreglos
                            total={stats?.totals?.arreglos ?? null}
                            cobrados={stats?.arreglos?.cobrados ?? null}
                            pendientes={stats?.arreglos?.pendientes ?? null}
                        />
                    </Card>
                </div>
            </div>




        </div>
    );
}

const styles = {
    mainPanel: {
        display: "flex",
        flexDirection: "row",
        gap: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 600,
        marginBottom: 12,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
          fontSize: 18,
        },
      },
} as const;