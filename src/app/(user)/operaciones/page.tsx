"use client";

import React, { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import type { Operacion } from "@/model/types";
import { formatDateLabel, formatDateTimeLabel } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import {
    ArrowLeftRight,
    Building2,
    CircleDollarSign,
    Coins,
    Package,
    Receipt,
    SlidersHorizontal,
    Truck,
    Wrench,
} from "lucide-react";
import { TipoOperacion, TIPOS_OPERACIONES } from "@/model/types";
import { useTenant } from "@/app/providers/TenantProvider";
import CardDato from "@/app/components/graficos/CardDato";
import Color from "color";


const tipoConfig: Record<
    TipoOperacion,
    { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
    compra: {
        label: "Compra",
        icon: <Truck size={18} />,
        color: COLOR.SEMANTIC.DANGER,
        bg: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
    },
    venta: {
        label: "Venta",
        icon: <Receipt size={18} />,
        color: COLOR.SEMANTIC.SUCCESS,
        bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    },
    asignacion_arreglo: {
        label: "Asignación",
        icon: <Wrench size={18} />,
        color: COLOR.SEMANTIC.INFO,
        bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    },
    ajuste: {
        label: "Ajuste",
        icon: <SlidersHorizontal size={18} />,
        color: COLOR.SEMANTIC.WARNING,
        bg: Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
    },
    transferencia: {
        label: "Transferencia",
        icon: <ArrowLeftRight size={18} />,
        color: COLOR.SEMANTIC.DISABLED,
        bg: Color(COLOR.SEMANTIC.DISABLED).alpha(0.12).toString(),
    },
};

function shortId(value: string) {
    if (!value) return "-";
    return value.slice(0, 8).toUpperCase();
}

function getTotals(operacion: Operacion) {
    const totalLineas = operacion.lineas?.length ?? 0;
    const totalMonto = (operacion.lineas ?? []).reduce(
        (acc, linea) => acc + (linea.cantidad || 0) * (linea.monto_unitario || 0),
        0
    );
    return { totalLineas, totalMonto };
}

export default function OperacionesPage() {
    const { operaciones, loading, fetchAll } = useOperaciones();
    const { talleres } = useTenant();
    const [search, setSearch] = useState("");
    const [selectedTipos, setSelectedTipos] = useState<TipoOperacion[]>([]);

    useEffect(() => {
        fetchAll();
    }, [talleres, fetchAll]);

    const toggleTipo = (tipo: TipoOperacion) => {
        setSelectedTipos((prev) =>
            prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
        );
    };

    const operacionesFiltradas = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (operaciones ?? [])
            .filter((o) => selectedTipos.length === 0 || selectedTipos.includes(o.tipo as TipoOperacion))
            .filter((o) => {
                if (!q) return true;
                const { totalLineas, totalMonto } = getTotals(o);
                return [
                    o.tipo,
                    talleres.find(t => t.id === o.taller_id)?.nombre || shortId(o.taller_id),
                    formatDateLabel(o.created_at),
                    String(totalLineas),
                    String(totalMonto),
                ]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q));
            });
    }, [operaciones, search, selectedTipos, talleres]);

    return (
        <div>
            <ScreenHeader
                title="Operaciones"
                subtitle="Gestiona compras y ventas de stock"
            />
            <div css={styles.cardDatosContainer}>
                <CardDato
                    titleText="Ventas"
                    value={2856410}
                    prefix="$"
                    icon={<Receipt size={22} color={COLOR.SEMANTIC.SUCCESS} />}
                    style={{color: COLOR.SEMANTIC.SUCCESS}}
                />
                <CardDato
                    titleText="Compras"
                    value={748550}
                    prefix="$"
                    icon={<Truck size={22} color={COLOR.SEMANTIC.DANGER} />}
                    style={{color: COLOR.SEMANTIC.DANGER}}
                />
                <CardDato
                    titleText="Asignaciones"
                    value={326500}
                    prefix="$"
                    icon={<Wrench size={22} color={COLOR.SEMANTIC.INFO} />}
                    style={{color: COLOR.SEMANTIC.INFO}}
                />
                <CardDato
                    titleText="Resultado Mensual"
                    value={1781360}
                    prefix="$"
                    icon={<CircleDollarSign size={22} color={COLOR.SEMANTIC.SUCCESS} />}
                    style={{color: COLOR.SEMANTIC.SUCCESS}}
                />
            </div>
            <div style={styles.searchBarContainer}>
                <div style={styles.searchRow}>
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar operaciones..."
                        style={styles.searchBar}
                    />
                </div>
                <div css={styles.chipsContainer} aria-label="Filtrar por tipo de operación">
                    {TIPOS_OPERACIONES.map((tipo) => {
                        const config = tipoConfig[tipo];
                        const isSelected = selectedTipos.includes(tipo);
                        return (
                            <button
                                key={tipo}
                                type="button"
                                onClick={() => toggleTipo(tipo)}
                                css={[styles.chipBase, isSelected && styles.chipSelected, styles.chipResponsive]}
                            >
                                <span style={styles.chipIcon}>{config.icon}</span>
                                {config.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={styles.resultsHeader}>
                <div style={styles.resultsTitle}><h2>Listado</h2></div>
                <div style={styles.resultsCount}>
                    {operacionesFiltradas.length} de {operaciones.length} operaciones
                </div>
            </div>

            {loading ? (
                <ListSkeleton rows={6} />
            ) : operacionesFiltradas.length === 0 ? (
                <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
                    <div style={styles.empty}>
                        <div style={styles.emptyTitle}>No se encontraron operaciones</div>
                        <div style={styles.emptySub}>Probá ajustando la búsqueda o los filtros.</div>
                    </div>
                </Card>
            ) : (
                <div style={styles.list}>
                    {operacionesFiltradas.map((operacion) => {
                        const tipo = (operacion.tipo as TipoOperacion) || "ajuste";
                        const config = tipoConfig[tipo] ?? tipoConfig.ajuste;
                        const { totalLineas, totalMonto } = getTotals(operacion);

                        return (
                            <Card key={operacion.id} style={styles.card}>
                                <div style={styles.cardRow}>
                                    <div style={{ ...styles.iconWrap, background: config.bg, color: config.color }}>
                                        {config.icon}
                                    </div>

                                    <div style={styles.cardContent}>
                                        <div style={styles.titleRow}>
                                            <div style={styles.title}>{config.label}</div>
                                            <div style={styles.date}>{formatDateTimeLabel(operacion.created_at)}</div>
                                        </div>

                                        <div style={styles.metaRow}>
                                            <IconLabel
                                                icon={<Building2 size={14} color={COLOR.ICON.MUTED} />}
                                                label={`Taller ${talleres.find(t => t.id === operacion.taller_id)?.nombre}`}
                                                style={styles.metaItem}
                                            />
                                            <IconLabel
                                                icon={<Package size={14} color={COLOR.ICON.MUTED} />}
                                                label={`${totalLineas} productos`}
                                                style={styles.metaItem}
                                            />
                                            <IconLabel
                                                icon={<Coins size={14} color={COLOR.ICON.MUTED} />}
                                                label={formatArs(totalMonto)}
                                                style={styles.metaItem}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const styles = {
    cardDatosContainer: css({
        display: "grid",
        gap: 16,
        marginTop: 12,
        marginBottom: 16,
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        },
    }),
    searchBarContainer: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 10,
        marginBottom: 16,
        marginTop: 8,
    },
    searchRow: {
        display: "flex",
        gap: 12,
        alignItems: "center",
    },
    searchBar: {
        width: "100%",
    },
    chipsContainer: css({
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexWrap: "wrap",
    }),
    chipBase: css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: "24px",
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.BACKGROUND.SUBTLE,
        color: COLOR.TEXT.PRIMARY,
        cursor: "pointer",
        fontWeight: 500,
        transition:
            "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease, color 150ms ease",
        "&:hover": {
            borderColor: COLOR.ACCENT.PRIMARY,
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0, 128, 162, 0.15)",
        },
    }),
    chipSelected: css({
        background: COLOR.BUTTON.PRIMARY.BACKGROUND,
        borderColor: COLOR.ACCENT.PRIMARY,
        color: COLOR.BUTTON.PRIMARY.TEXT,
        boxShadow: "none",
    }),
    chipResponsive: css({
        [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
            fontSize: "14px",
            padding: "6px 12px",
        },
    }),
    chipIcon: {
        display: "flex",
        alignItems: "center",
    },
    resultsHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: 600,
    },
    resultsCount: {
        color: COLOR.TEXT.SECONDARY,
        fontSize: 14,
    },
    list: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    card: {
        cursor: "default",
    },
    cardRow: {
        display: "flex",
        alignItems: "center",
        gap: 16,
    },
    iconWrap: {
        height: 44,
        width: 44,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    cardContent: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 6,
        width: "100%",
        minWidth: 0,
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: 600,
    },
    date: {
        fontSize: 13,
        color: COLOR.TEXT.SECONDARY,
        whiteSpace: "nowrap" as const,
    },
    metaRow: {
        display: "flex",
        gap: 14,
        flexWrap: "wrap" as const,
        color: COLOR.TEXT.SECONDARY,
        fontSize: 13,
    },
    metaItem: {
        color: COLOR.TEXT.SECONDARY,
        fontSize: 13,
    },
    empty: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 4,
        padding: 12,
    },
    emptyTitle: {
        fontWeight: 600,
        color: COLOR.TEXT.PRIMARY,
    },
    emptySub: {
        color: COLOR.TEXT.SECONDARY,
        fontSize: 14,
    },
} as const;
