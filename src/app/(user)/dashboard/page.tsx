"use client";

import React from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import { useDashboard } from "@/app/providers/DashboardProvider";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import CantidadTiposArreglos from "@/app/components/graficos/CantidadTiposArreglos";
import EstadoCobroArreglos from "@/app/components/graficos/EstadoCobroArreglos";
import CardDato from "@/app/components/graficos/CardDato";
import GraficoArea from "@/app/components/graficos/CantidadNuevosClientes";
import RecentActivityCard from "@/app/components/dashboard/RecentActivityCard";
import { Car, CircleDollarSign, Users, Wrench } from "lucide-react";
import { ROUTES } from "@/routing/routes";
import { useRouter } from "next/navigation";
import { css } from "@emotion/react";

export default function DashboardPage() {
    const router = useRouter();
    const { stats, loading, error } = useDashboard();

    return (
        <div>
            <ScreenHeader title="Dashboard" />



            <div css={styles.mainPanel}>
                <CardDato
                    titleText="Clientes"
                    value={stats?.totals?.clientes}
                    icon={<Users size={22} color={COLOR.ACCENT.PRIMARY} />}
                    onClick={() => router.push(ROUTES.clientes)}
                />
                <CardDato
                    titleText="Vehiculos"
                    value={stats?.totals?.vehiculos}
                    icon={<Car size={22} color={COLOR.ACCENT.PRIMARY} />}
                    onClick={() => router.push(ROUTES.vehiculos)}
                />
                <CardDato
                    titleText="Arreglos"
                    value={stats?.totals?.arreglos}
                    icon={<Wrench size={22} color={COLOR.ACCENT.PRIMARY} />}
                    onClick={() => router.push(ROUTES.arreglos)}
                />
                <CardDato
                    titleText="Ingresos Mensuales"
                    value={stats?.totals?.montoIngresos}
                    prefix="$"
                    icon={<CircleDollarSign size={22} color={COLOR.ACCENT.PRIMARY} />}
                />
            </div>

            <div css={styles.mainPanel}>
                <div style={{ width: "100%" }}>
                    <h3 css={styles.title}>Clientes | Nuevos este mes</h3>
                    <Card style={{padding: '16px 4px'}}>
                        {loading ? (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        ) : null}

                        {error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>
                                {error}
                            </div>
                        ) : null}

                        <GraficoArea
                            x={stats?.clientes?.nuevosEsteMes?.dias}
                            values={stats?.clientes?.nuevosEsteMes?.valor}
                        />
                    </Card>
                </div>
            </div>

            <div css={styles.mainPanel}>
                <div css={styles.grafico}>
                    <h3 css={styles.title}>Arreglos | Tipos</h3>
                    <Card>
                        {loading ? (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        ) : null}
                        {error ? (
                            <div style={{ color: COLOR.ICON.DANGER, fontSize: 13 }}>
                                {error}
                            </div>
                        ) : null}

                        <CantidadTiposArreglos
                            items={(() => {
                                const tipos = stats?.arreglos?.tipos?.tipos ?? [];
                                const cantidad = stats?.arreglos?.tipos?.cantidad ?? [];
                                const ingresos = stats?.arreglos?.tipos?.ingresos ?? [];

                                const len = Math.min(
                                    tipos.length,
                                    cantidad.length,
                                    ingresos.length
                                );

                                return Array.from({ length: len }).map((_, idx) => ({
                                    tipo: tipos[idx] ?? `Tipo ${idx + 1}`,
                                    cantidad: cantidad[idx] ?? 0,
                                    ingresos: ingresos[idx] ?? 0,
                                }));
                            })()}
                        />
                    </Card>
                </div>

                <div css={styles.grafico}>
                    <h3 css={styles.title}>Arreglos | Estado de pago</h3>
                    <Card>
                        {loading ? (
                            <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>
                                Cargando...
                            </span>
                        ) : null}

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
    mainPanel: css({
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 16,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            flexDirection: 'column',
        },
    }),
    cardDatos: css({
        width: "100%",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "50%",
        },
    }),
    grafico: css({
        width: "50%",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "100%",
        },
    }),
    activityPanel: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 16,
    },
    activityList: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 600,
        marginBottom: 8,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            fontSize: 18,
        },
    },
} as const;