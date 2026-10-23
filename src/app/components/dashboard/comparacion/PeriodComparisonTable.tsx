"use client";

import React, { useEffect, useRef, useState } from "react";
import { CircleHelp, Eye, EyeOff, GripVertical, RotateCw, X } from "lucide-react";
import IconButton from "@/app/components/ui/IconButton";
import Tooltip from "@/app/components/ui/Tooltip";
import type { ComparisonRowView } from "@/app/hooks/dashboard/useDashboardControls";
import { computeDelta, type ComparisonColumn, type Sentiment } from "@/lib/dashboard/cards";
import { MAX_VISIBLE_PERIODS } from "@/lib/dashboard/comparison";
import { formatArs, formatNumberAr } from "@/lib/format";
import { COLOR } from "@/theme/theme";

type Props = {
    rows: ComparisonRowView[];
    columns: ComparisonColumn[];
    onToggleVisibility: (rowId: string) => void;
    onRemove: (rowId: string) => void;
    onRetry: (rowId: string) => void;
    /** Mueve la fila a `toIndex` (posición final). */
    onMove: (rowId: string, toIndex: number) => void;
};

function formatValue(value: number | null, format: ComparisonColumn["format"]): string {
    if (value === null) return "—";
    if (format === "currency") return formatArs(value, { maxDecimals: 0 });
    if (format === "percent") return `${formatNumberAr(value * 100, { maxDecimals: 1 })}%`;
    return formatNumberAr(value, { maxDecimals: 0 });
}

function formatDelta(delta: number, format: ComparisonColumn["format"]): string {
    const arrow = delta > 0 ? "▲" : "▼";
    if (format === "percent") return `${arrow} ${formatNumberAr(Math.abs(delta), { maxDecimals: 1 })} p.p.`;
    const pct = Math.abs(delta) * 100;
    return `${arrow} ${formatNumberAr(pct, { maxDecimals: pct < 10 ? 1 : 0 })}%`;
}

function deltaColor(delta: number, sentiment: Sentiment): string {
    if (sentiment === "neutral") return COLOR.TEXT.SECONDARY;
    const isGood = sentiment === "positive" ? delta > 0 : delta < 0;
    return isGood ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.DANGER;
}

function visibilityTitle(row: ComparisonRowView): string {
    if (row.visibilityBlocker === "max") return `Se pueden graficar hasta ${MAX_VISIBLE_PERIODS} períodos a la vez`;
    if (row.visibilityBlocker === "last") return "Tiene que quedar al menos un período en el gráfico";
    return row.visible ? "Ocultar del gráfico" : "Mostrar en el gráfico";
}

const REFERENCE_HELP = "Cada período se compara contra el de arriba de todo. Arrastrá las filas para cambiar el orden.";

/** Alto fijo de cada fila (el de una fila con período y aclaración en dos líneas). */
export const COMPARISON_ROW_HEIGHT = 49;

/** Fila que se está arrastrando: de dónde salió, dónde empezó el puntero y cuánto se movió. */
type DragState = { id: string; from: number; startY: number; offset: number; rowHeight: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Filas = períodos (compartidas entre cards); columnas = métricas de la card activa. La primera fila
 * es la referencia del Δ%; las filas se reordenan arrastrando la manija o con las flechas del teclado.
 */
export default function PeriodComparisonTable({ rows, columns, onToggleVisibility, onRemove, onRetry, onMove }: Props) {
    const referenceTotals = rows[0]?.totals ?? null;
    const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
    const [drag, setDrag] = useState<DragState | null>(null);
    // Al mover el nodo en el DOM la manija pierde el foco; se lo devolvemos para seguir con el teclado.
    const refocusHandleOf = useRef<string | null>(null);

    useEffect(() => {
        const rowId = refocusHandleOf.current;
        if (!rowId) return;
        refocusHandleOf.current = null;
        rowRefs.current.get(rowId)?.querySelector<HTMLButtonElement>("[data-drag-handle]")?.focus();
    }, [rows]);

    // Posición en la que caería la fila si se suelta ahora.
    const target = drag ? clamp(drag.from + Math.round(drag.offset / drag.rowHeight), 0, rows.length - 1) : null;

    // La fila arrastrada sigue al puntero; las que quedan entre su origen y el destino se corren un
    // lugar para hacerle espacio.
    const shiftFor = (rowId: string, index: number): number => {
        if (!drag || target === null) return 0;
        if (rowId === drag.id) return drag.offset;
        if (drag.from < target && index > drag.from && index <= target) return -drag.rowHeight;
        if (drag.from > target && index >= target && index < drag.from) return drag.rowHeight;
        return 0;
    };

    return (
        <div style={styles.scroller}>
            <table
                style={{ ...styles.table, ...(drag ? styles.tableDragging : {}) }}
                data-testid="comparacion-periodos-tabla"
            >
                <thead>
                    <tr>
                        <th style={{ ...styles.th, ...styles.stickyCell, textAlign: "left" }}>Período</th>
                        {columns.map((column) => (
                            <th key={column.key} style={{ ...styles.th, textAlign: "right" }}>
                                {column.label}
                            </th>
                        ))}
                        <th style={styles.th} aria-label="Acciones" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const isDragged = drag?.id === row.id;
                        // El desplazamiento va en cada celda: en un <tr> no todos los navegadores lo
                        // aplican, y así la celda fija de la izquierda se mueve con su fila.
                        const cellStyle = {
                            ...styles.td,
                            transform: `translateY(${shiftFor(row.id, index)}px)`,
                            transition: drag && !isDragged ? "transform 150ms ease" : "none",
                            ...(isDragged ? styles.draggedCell : {}),
                        };

                        return (
                            <tr
                                key={row.id}
                                ref={(el) => {
                                    if (el) rowRefs.current.set(row.id, el);
                                    else rowRefs.current.delete(row.id);
                                }}
                                data-dragging={isDragged || undefined}
                                data-testid={`comparacion-fila-${row.id}`}
                            >
                                <td style={{ ...cellStyle, ...styles.stickyCell, ...(isDragged ? styles.draggedStickyCell : {}) }}>
                                    <div style={styles.periodCell}>
                                        {rows.length > 1 && (
                                            <button
                                                type="button"
                                                style={{ ...styles.dragHandle, cursor: drag ? "grabbing" : "grab" }}
                                                aria-label={`Mover ${row.label}. Usá las flechas arriba y abajo para reordenar`}
                                                title="Arrastrá para reordenar"
                                                onPointerDown={(e) => {
                                                    if (e.button !== 0) return;
                                                    e.preventDefault();
                                                    // Captura el puntero para seguir el arrastre aunque salga de la manija.
                                                    e.currentTarget.setPointerCapture?.(e.pointerId);
                                                    const measured = rowRefs.current.get(row.id)?.getBoundingClientRect().height;
                                                    setDrag({
                                                        id: row.id,
                                                        from: index,
                                                        startY: e.clientY,
                                                        offset: 0,
                                                        rowHeight: measured || COMPARISON_ROW_HEIGHT,
                                                    });
                                                }}
                                                onPointerMove={(e) => {
                                                    if (drag?.id !== row.id) return;
                                                    // No deja salir la fila de la tabla.
                                                    const offset = clamp(
                                                        e.clientY - drag.startY,
                                                        -drag.from * drag.rowHeight,
                                                        (rows.length - 1 - drag.from) * drag.rowHeight,
                                                    );
                                                    setDrag({ ...drag, offset });
                                                }}
                                                onPointerUp={() => {
                                                    if (drag?.id === row.id && target !== null && target !== drag.from) {
                                                        onMove(row.id, target);
                                                    }
                                                    setDrag(null);
                                                }}
                                                onPointerCancel={() => setDrag(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                                                    e.preventDefault();
                                                    refocusHandleOf.current = row.id;
                                                    onMove(row.id, index + (e.key === "ArrowUp" ? -1 : 1));
                                                }}
                                                data-drag-handle
                                                data-testid={`comparacion-mover-${row.id}`}
                                            >
                                                <GripVertical size={14} />
                                            </button>
                                        )}
                                        <IconButton
                                            icon={row.visible ? <Eye /> : <EyeOff />}
                                            size={16}
                                            style={styles.iconButton}
                                            onClick={() => onToggleVisibility(row.id)}
                                            disabled={row.visibilityBlocker !== null}
                                            title={visibilityTitle(row)}
                                            ariaLabel={`${visibilityTitle(row)}: ${row.label}`}
                                            aria-pressed={row.visible}
                                        />
                                        <span
                                            aria-hidden
                                            style={{
                                                ...styles.dot,
                                                background: row.visible ? row.color : "transparent",
                                                borderColor: row.visible ? row.color : COLOR.BORDER.DEFAULT,
                                            }}
                                        />
                                        <div style={styles.periodText}>
                                            <span style={styles.periodLabel}>
                                                {row.label}
                                                {row.isReference && rows.length > 1 && (
                                                    <Tooltip content={REFERENCE_HELP} placement="top" trigger="both" maxWidth={240}>
                                                        <button
                                                            type="button"
                                                            style={styles.helpButton}
                                                            aria-label={REFERENCE_HELP}
                                                            data-testid="comparacion-ayuda-referencia"
                                                        >
                                                            <CircleHelp size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </span>
                                            {row.detail && <span style={styles.periodDetail}>{row.detail}</span>}
                                        </div>
                                    </div>
                                </td>

                                {row.status === "ready" && row.totals ? (
                                    columns.map((column) => {
                                        const value = row.totals![column.key];
                                        const delta = row.isReference
                                            ? null
                                            : computeDelta(value, referenceTotals?.[column.key] ?? null, column.format);
                                        return (
                                            <td key={column.key} style={{ ...cellStyle, ...styles.numberCell }}>
                                                <div>{formatValue(value, column.format)}</div>
                                                {delta !== null && (
                                                    <div
                                                        style={{
                                                            ...styles.delta,
                                                            color: delta === 0 ? COLOR.TEXT.SECONDARY : deltaColor(delta, column.sentiment),
                                                        }}
                                                    >
                                                        {delta === 0 ? "= ref." : formatDelta(delta, column.format)}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })
                                ) : (
                                    <td colSpan={columns.length} style={{ ...cellStyle, ...styles.statusCell }}>
                                        {row.status === "error" ? (
                                            <span style={styles.errorText}>
                                                {row.error ?? "No se pudo cargar el período"}
                                                <IconButton
                                                    icon={<RotateCw />}
                                                    size={14}
                                                    style={styles.iconButton}
                                                    onClick={() => onRetry(row.id)}
                                                    title="Reintentar"
                                                    ariaLabel={`Reintentar ${row.label}`}
                                                />
                                            </span>
                                        ) : (
                                            "Cargando…"
                                        )}
                                    </td>
                                )}

                                <td style={{ ...cellStyle, ...styles.actionCell }}>
                                    <IconButton
                                        icon={<X />}
                                        size={16}
                                        style={styles.iconButton}
                                        onClick={() => onRemove(row.id)}
                                        title="Quitar período"
                                        ariaLabel={`Quitar ${row.label}`}
                                        hoverColor={COLOR.SEMANTIC.DANGER}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const styles = {
    scroller: {
        width: "100%",
        overflowX: "auto" as const,
    },
    table: {
        width: "100%",
        borderCollapse: "collapse" as const,
        fontSize: 13,
        color: COLOR.TEXT.PRIMARY,
        fontVariantNumeric: "tabular-nums" as const,
    },
    tableDragging: {
        userSelect: "none" as const,
    },
    th: {
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: COLOR.TEXT.SECONDARY,
        borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
        whiteSpace: "nowrap" as const,
        background: COLOR.BACKGROUND.SECONDARY,
    },
    // Todas las filas miden lo mismo: con o sin aclaración, Δ%, carga o error.
    td: {
        height: COMPARISON_ROW_HEIGHT,
        boxSizing: "border-box" as const,
        padding: "4px 10px",
        borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
        verticalAlign: "middle" as const,
        background: COLOR.BACKGROUND.SECONDARY,
    },
    // El período queda fijo a la izquierda cuando la tabla scrollea en pantallas chicas.
    stickyCell: {
        position: "sticky" as const,
        left: 0,
        zIndex: 1,
        minWidth: 210,
    },
    // Fila "levantada" mientras se arrastra: por encima de las demás y con borde de acento.
    draggedCell: {
        position: "relative" as const,
        zIndex: 3,
        background: COLOR.BACKGROUND.SUBTLE,
        boxShadow: `inset 0 1px 0 ${COLOR.ACCENT.PRIMARY}, inset 0 -1px 0 ${COLOR.ACCENT.PRIMARY}, 0 6px 12px rgba(0, 0, 0, 0.12)`,
    },
    // La celda fija ya tiene su propio zIndex: la arrastrada tiene que seguir quedando arriba.
    draggedStickyCell: {
        zIndex: 3,
    },
    periodCell: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    },
    dragHandle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
        border: "none",
        borderRadius: 4,
        background: "transparent",
        color: COLOR.ICON.MUTED,
        touchAction: "none" as const,
    },
    iconButton: {
        padding: 4,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        border: "2px solid",
        flexShrink: 0,
        boxSizing: "border-box" as const,
    },
    periodText: {
        display: "flex",
        flexDirection: "column" as const,
        minWidth: 0,
    },
    periodLabel: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 600,
        whiteSpace: "nowrap" as const,
    },
    helpButton: {
        display: "inline-flex",
        alignItems: "center",
        padding: 0,
        border: "none",
        background: "transparent",
        color: COLOR.ICON.MUTED,
        cursor: "help",
    },
    periodDetail: {
        fontSize: 11,
        color: COLOR.TEXT.SECONDARY,
        whiteSpace: "nowrap" as const,
    },
    numberCell: {
        textAlign: "right" as const,
        whiteSpace: "nowrap" as const,
    },
    delta: {
        fontSize: 11,
        fontWeight: 500,
    },
    statusCell: {
        color: COLOR.TEXT.SECONDARY,
        fontSize: 12,
    },
    errorText: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: COLOR.SEMANTIC.DANGER,
    },
    actionCell: {
        width: 32,
        textAlign: "right" as const,
    },
} as const;
