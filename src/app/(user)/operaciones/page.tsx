"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import PeriodSelector from "@/app/components/dashboard/PeriodSelector";
import SearchBar from "@/app/components/ui/SearchBar";
import ScrollPage from "@/app/components/ui/ScrollPage";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import Card from "@/app/components/ui/Card";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatDateLabel } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import {
    ArrowDownRight,
    ArrowLeftRight,
    ArrowUpRight,
    CircleDollarSign,
    PlusIcon,
    Receipt,
    SlidersHorizontal,
    Truck,
    WalletCards,
    Wrench,
} from "lucide-react";
import { TipoOperacion, TIPOS_OPERACIONES } from "@/model/types";
import { useTenant } from "@/app/providers/TenantProvider";
import Color from "color";
import OperacionCreateModal from "@/app/components/operaciones/OperacionCreateModal";
import LineDetalleOperacion from "@/app/components/operaciones/LineDetalleOperacion";
import Button from "@/app/components/ui/Button";
import { useToast } from "@/app/providers/ToastProvider";
import { finanzasClient } from "@/clients/finanzasClient";
import type { GastoFinanciero } from "@/model/finanzas";


const tipoConfig: Record<
    TipoOperacion,
    { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
    COMPRA: {
        label: "Compra",
        icon: <Truck size={18} />,
        color: COLOR.SEMANTIC.DANGER,
        bg: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
    },
    VENTA: {
        label: "Venta",
        icon: <Receipt size={18} />,
        color: COLOR.SEMANTIC.SUCCESS,
        bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    },
    GASTO: {
        label: "Gasto",
        icon: <WalletCards size={18} />,
        color: COLOR.SEMANTIC.DANGER,
        bg: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
    },
    ASIGNACION_ARREGLO: {
        label: "Asignación",
        icon: <Wrench size={18} />,
        color: COLOR.SEMANTIC.INFO,
        bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    },
    COBRO_ARREGLO: {
        label: "Cobro de arreglo",
        icon: <CircleDollarSign size={18} />,
        color: COLOR.SEMANTIC.SUCCESS,
        bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    },
    AJUSTE: {
        label: "Ajuste",
        icon: <SlidersHorizontal size={18} />,
        color: COLOR.SEMANTIC.WARNING,
        bg: Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
    },
    INGRESO: {
        label: "Ingreso",
        icon: <CircleDollarSign size={18} />,
        color: COLOR.SEMANTIC.SUCCESS,
        bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    },
    APERTURA_CUENTA: {
        label: "Apertura de cuenta",
        icon: <WalletCards size={18} />,
        color: COLOR.SEMANTIC.INFO,
        bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    },
    TRANSFERENCIA: {
        label: "Transferencia",
        icon: <ArrowLeftRight size={18} />,
        color: COLOR.SEMANTIC.DISABLED,
        bg: Color(COLOR.SEMANTIC.DISABLED).alpha(0.12).toString(),
    },
    MOVIMIENTO_CUENTA: {
        label: "Movimiento",
        icon: <WalletCards size={18} />,
        color: COLOR.SEMANTIC.INFO,
        bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    },
};

function shortId(value?: string | null) {
    if (!value) return "-";
    return value.slice(0, 8).toUpperCase();
}

function getTotals(operacion: Operacion) {
    if (["GASTO", "COBRO_ARREGLO", "INGRESO", "APERTURA_CUENTA", "TRANSFERENCIA", "MOVIMIENTO_CUENTA"].includes(operacion.tipo)) {
        return { totalLineas: 0, totalMonto: Number(operacion.monto) || 0 };
    }
    const totalLineas = operacion.lineas?.length ?? 0;
    const totalMonto = (operacion.lineas ?? []).reduce(
        (acc, linea) => acc + (linea.cantidad || 0) * (linea.monto_unitario || 0),
        0
    );
    return { totalLineas, totalMonto };
}

function ResumenMetrica({
    label,
    value,
    color,
}: {
    label: string;
    value: number | undefined;
    color: string;
}) {
    return (
        <div css={styles.resumenMetrica}>
            <span css={styles.resumenMetricaLabel}>{label}</span>
            <strong css={styles.resumenMetricaValor} style={{ color }}>
                {formatArs(value ?? 0)}
            </strong>
        </div>
    );
}

export default function OperacionesPage() {
    const {
        operaciones,
        loading,
        selectedTipos,
        stats,
        setSelectedTipos,
        remove,
        refresh,
        period,
        setPeriod,
        pagination,
        hasMore,
        loadMore,
    } = useOperaciones();
    const { talleres } = useTenant();
    const { getStockById } = useInventario();
    const { success, error } = useToast();
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [initialTipo, setInitialTipo] = useState<TipoOperacion>("VENTA");
    const [cuentaGastoPreseleccionadaId, setCuentaGastoPreseleccionadaId] = useState<string | null>(null);
    const [gastoEdit, setGastoEdit] = useState<GastoFinanciero | null>(null);
    const [expandedOperacionId, setExpandedOperacionId] = useState<string | null>(null);
    const [stocksById, setStocksById] = useState<Record<string, StockItem>>({});
    const loadedStockIdsRef = useRef<Set<string>>(new Set());
    const loadingInitial = loading && operaciones.length === 0;
    const loadingMore = loading && operaciones.length > 0;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("nuevo") !== "gasto") return;

        setCuentaGastoPreseleccionadaId(params.get("cuenta_financiera_id"));
        setInitialTipo("GASTO");
        setCreateOpen(true);
        window.history.replaceState(null, "", window.location.pathname);
    }, []);

    useEffect(() => {
        const ids = new Set<string>();
        (operaciones ?? []).forEach((o) =>
            (o.lineas ?? []).forEach((l) => {
                if (l.stock_id) ids.add(l.stock_id);
            })
        );

        const missing = Array.from(ids).filter((id) => !loadedStockIdsRef.current.has(id));
        if (missing.length === 0) return;

        let cancelled = false;
        void (async () => {
            const results = await Promise.all(
                missing.map((id) => getStockById(id).catch(() => null))
            );
            if (cancelled) return;

            setStocksById((prev) => {
                const next = { ...prev };
                missing.forEach((id, idx) => {
                    const stock = results[idx];
                    if (stock) next[id] = stock;
                });
                return next;
            });
            missing.forEach((id) => loadedStockIdsRef.current.add(id));
        })();

        return () => {
            cancelled = true;
        };
    }, [operaciones, getStockById]);

    const toggleTipo = (tipo: TipoOperacion) => {
        setSelectedTipos((prev) =>
            prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
        );
    };

    const operacionesFiltradas = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (operaciones ?? [])
            .filter((o) => {
                if (!q) return true;
                const { totalLineas, totalMonto } = getTotals(o);
                return [
                    o.tipo,
                    o.descripcion,
                    o.categoria_gasto,
                    o.cuenta_financiera_nombre,
                    talleres.find(t => t.id === o.taller_id)?.nombre || shortId(o.taller_id),
                    formatDateLabel(o.created_at),
                    String(totalLineas),
                    String(totalMonto),
                ]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q));
            });
    }, [operaciones, search, talleres]);

    const handleDelete = useCallback(async (operacion: Operacion) => {
        try {
            if (operacion.tipo === "GASTO") {
                const gastoId = operacion.gasto_id ?? operacion.id;
                const response = await finanzasClient.eliminarGasto(gastoId);
                if (response.error) throw new Error(response.error);
                await refresh();
                success("Gasto eliminado", "El gasto se revirtió correctamente.");
                return;
            }
            await remove(operacion.id);
            success("Operación eliminada", "La operación se eliminó correctamente.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "No se pudo eliminar la operación";
            error("Error eliminando operación", message);
        }
    }, [error, refresh, remove, success]);

    const handleEditGasto = useCallback((operacion: Operacion) => {
        const gastoId = operacion.gasto_id ?? operacion.id;
        setGastoEdit({
            id: gastoId,
            cuentaId: operacion.cuenta_financiera_id ?? "",
            categoria: operacion.categoria_gasto ?? "OTROS",
            importe: Number(operacion.monto) || 0,
            fecha: operacion.fecha,
            descripcion: operacion.descripcion ?? "",
            arregloId: null,
            operacionId: null,
            createdAt: operacion.created_at,
            updatedAt: operacion.created_at,
        });
        setInitialTipo("GASTO");
        setCreateOpen(true);
    }, []);

    return (
        <div>
            <div css={styles.headerRow}>
                <ScreenHeader
                    title="Operaciones"
                    subtitle="Gestioná los movimientos del stock: compras, ventas, ingresos y egresos."
                />
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>
            <div css={styles.cardDatosContainer}>
                <Card style={styles.resumenGrupoCard} aria-label="Resumen de ingresos">
                    <div css={styles.resumenGrupoTitulo}>
                        <ArrowUpRight size={20} color={COLOR.SEMANTIC.SUCCESS} />
                        Ingresos
                    </div>
                    <div css={styles.resumenMetricasDosColumnas}>
                        <ResumenMetrica label="Ventas" value={stats?.ventas} color={COLOR.SEMANTIC.SUCCESS} />
                        <ResumenMetrica label="Cobros de arreglos" value={stats?.cobros} color={COLOR.SEMANTIC.SUCCESS} />
                    </div>
                </Card>

                <Card style={styles.resumenGrupoCard} aria-label="Resumen de egresos">
                    <div css={styles.resumenGrupoTitulo}>
                        <ArrowDownRight size={20} color={COLOR.SEMANTIC.DANGER} />
                        Egresos
                    </div>
                    <div css={styles.resumenMetricasTresColumnas}>
                        <ResumenMetrica label="Compras" value={stats?.compras} color={COLOR.SEMANTIC.DANGER} />
                        <ResumenMetrica label="Repuestos usados" value={stats?.asignaciones} color={COLOR.SEMANTIC.DANGER} />
                        <ResumenMetrica label="Gastos eventuales" value={stats?.gastos} color={COLOR.SEMANTIC.DANGER} />
                    </div>
                </Card>

                <Card
                    style={{ ...styles.resultadoCard, color: (stats?.neto ?? 0) >= 0 ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.DANGER }}
                    aria-label="Resultado del período"
                >
                    <div css={styles.resultadoTitulo}>
                        <CircleDollarSign size={18} />
                        Resultado del período
                    </div>
                    <strong css={styles.resultadoValor}>
                        {(stats?.neto ?? 0) < 0 ? "-" : ""}{formatArs(Math.abs(stats?.neto ?? 0))}
                    </strong>
                </Card>
            </div>
            <div style={styles.searchBarContainer}>
                <div style={styles.searchRow}>
                    <SearchBar
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar operaciones..."
                        style={styles.searchBar}
                    />
                    <Button
                        icon={<PlusIcon size={20} />}
                        text="Nueva operación"
                        onClick={() => {
                            setInitialTipo("VENTA");
                            setCuentaGastoPreseleccionadaId(null);
                            setGastoEdit(null);
                            setCreateOpen(true);
                        }}
                        css={styles.createButton}
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
                                data-testid={`operaciones-chip-${tipo}`}
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
                    {operacionesFiltradas.length} de {pagination.total} operaciones
                </div>
            </div>

            <ScrollPage
                loading={loadingInitial}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                loadingMoreLabel="Cargando más operaciones..."
            >
            {loadingInitial ? (
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
                        const tipo = (operacion.tipo as TipoOperacion) || "AJUSTE";
                        const config = tipoConfig[tipo] ?? tipoConfig.AJUSTE;

                        return (
                            <LineDetalleOperacion
                                key={operacion.id}
                                operacion={operacion}
                                tipoLabel={config.label}
                                tipoIcon={config.icon}
                                tipoColor={config.color}
                                tipoBg={config.bg}
                                tallerLabel={talleres.find(t => t.id === operacion.taller_id)?.nombre ?? shortId(operacion.taller_id)}
                                stocksById={stocksById}
                                expanded={expandedOperacionId === operacion.id}
                                onToggle={() => {
                                    setExpandedOperacionId((prev) => (prev === operacion.id ? null : operacion.id));
                                }}
                                onDelete={operacion.tipo === "COBRO_ARREGLO" ? undefined : () => {
                                    void handleDelete(operacion);
                                }}
                                onEdit={operacion.tipo === "GASTO" ? () => handleEditGasto(operacion) : undefined}
                            />
                        );
                    })}
                </div>
            )}
            </ScrollPage>

            {createOpen ? (
                <OperacionCreateModal
                    open={createOpen}
                    talleres={talleres}
                    initialTipo={initialTipo}
                    initialCuentaId={cuentaGastoPreseleccionadaId}
                    gasto={gastoEdit}
                    onClose={() => {
                        setCreateOpen(false);
                        setInitialTipo("VENTA");
                        setCuentaGastoPreseleccionadaId(null);
                        setGastoEdit(null);
                    }}
                />
            ) : null}
        </div>
    );
}

const styles = {
    headerRow: css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
    }),
    cardDatosContainer: css({
        display: "grid",
        gap: 16,
        marginTop: 12,
        marginBottom: 16,
        gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(220px, 1fr)",
        [`@media (max-width: ${BREAKPOINTS.xl}px)`]: {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
        },
    }),
    resumenGrupoCard: {
        padding: "4px",
        display: "flex",
        flexDirection: "column" as const,
        minHeight: 138,
    },
    resumenGrupoTitulo: css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px 4px",
        color: COLOR.TEXT.PRIMARY,
        fontSize: 18,
        fontWeight: 600,
    }),
    resumenMetricasDosColumnas: css({
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        flex: 1,
        "& > :not(:last-child)": {
            borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
        },
    }),
    resumenMetricasTresColumnas: css({
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        flex: 1,
        "& > :not(:last-child)": {
            borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
        },
    }),
    resumenMetrica: css({
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        minWidth: 0,
        padding: "12px 16px",
    }),
    resumenMetricaLabel: css({
        color: COLOR.TEXT.SECONDARY,
        fontSize: 13,
        lineHeight: 1.2,
    }),
    resumenMetricaValor: css({
        fontSize: 20,
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    }),
    resultadoCard: {
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "center",
        gap: 8,
        minHeight: 138,
    },
    resultadoTitulo: css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "inherit",
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
    }),
    resultadoValor: css({
        color: "inherit",
        fontSize: 28,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
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
        flexWrap: "nowrap" as const,
    },
    searchBar: {
        width: "100%",
    },
    actionBtn: css({
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 12px",
        borderRadius: 10,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.BACKGROUND.SUBTLE,
        color: COLOR.TEXT.PRIMARY,
        cursor: "pointer",
        whiteSpace: "nowrap",
        "&:hover": {
            borderColor: COLOR.ACCENT.PRIMARY,
        },
    }),
    actionBtnText: css({
        fontWeight: 600,
        fontSize: 14,
        [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
            display: "none",
        },
    }),
    createButton: css({
        height: 40,
        minWidth: 180,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "auto",
        },
    }),
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
