"use client";

import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Package, RotateCcw } from "lucide-react";
import type { OperacionMovimientoStock } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatDateLabel } from "@/lib/fechas";

export interface OperacionStockHistorialProps {
  movimientos?: OperacionMovimientoStock[];
  tipo?: string;
  revertiendoMovimientoId?: string | null;
  onRevertirMovimiento?: (movimientoId: string, cantidad: number, productoNombre?: string) => void;
}

export default function OperacionStockHistorial({
  movimientos,
  tipo = "VENTA",
  revertiendoMovimientoId,
  onRevertirMovimiento,
}: OperacionStockHistorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isVenta = tipo === "VENTA";

  // Filtramos los movimientos originales de entrega o recepción (no reversiones)
  const movimientosOriginales = useMemo(() => {
    return (movimientos ?? []).filter((m) => {
      const isReversion =
        m.tipo_movimiento === "REVERSION" ||
        Boolean(m.reversion_de_id) ||
        (m.motivo?.toLowerCase().includes("reversión") ?? false) ||
        (m.motivo?.toLowerCase().includes("reversion") ?? false);
      return !isReversion;
    });
  }, [movimientos]);

  const totalUnidades = useMemo(() => {
    return movimientosOriginales.reduce((acc, m) => {
      if (m.revertido) return acc;
      return acc + Math.abs(m.cantidad);
    }, 0);
  }, [movimientosOriginales]);

  if (!movimientos || movimientosOriginales.length === 0) {
    return null;
  }

  const sectionTitle = isVenta
    ? `Entregas registradas previamente (${movimientosOriginales.length})`
    : `Recepciones registradas previamente (${movimientosOriginales.length})`;

  return (
    <div css={styles.historialContainer}>
      <button
        type="button"
        css={styles.headerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        data-testid="operacion-stock-historial-toggle"
      >
        <div css={styles.headerLeft}>
          <span css={styles.sectionTitle}>{sectionTitle}</span>
          <span css={styles.totalBadge}>
            {totalUnidades} u. activas
          </span>
        </div>

        <ChevronDown size={16} css={styles.chevronIcon(isOpen)} />
      </button>

      {isOpen ? (
        <div css={styles.movimientosList} data-testid="operacion-stock-historial-list">
          {movimientosOriginales.map((mov) => {
            const unidades = Math.abs(mov.cantidad);
            const isRevertido = Boolean(mov.revertido);
            const isRevertiendo = revertiendoMovimientoId === mov.id;

            return (
              <div
                key={mov.id}
                css={[styles.movimientoRow, isRevertido && styles.movimientoRowRevertido]}
                data-testid={`stock-historial-item-${mov.id}`}
              >
                <div css={styles.movimientoInfo}>
                  <div css={styles.movimientoHeader}>
                    <span css={[styles.movimientoUnidades, isRevertido && styles.strikethrough]}>
                      {unidades} u.
                    </span>
                    <span css={styles.movimientoFecha}>
                      {formatDateLabel(mov.fecha || mov.created_at)}
                    </span>
                    {isRevertido ? (
                      <span css={styles.revertidoBadge}>Revertido</span>
                    ) : null}
                  </div>

                  <div css={styles.movimientoDetails}>
                    <Package size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    <span css={styles.prodNombre}>
                      {mov.producto_nombre || `Producto #${mov.producto_id.slice(0, 6)}`}
                    </span>
                    {mov.producto_codigo ? (
                      <span css={styles.prodCodigo}>({mov.producto_codigo})</span>
                    ) : null}
                    {mov.motivo ? (
                      <span css={styles.movimientoMotivo}>• {mov.motivo}</span>
                    ) : null}
                  </div>
                </div>

                {onRevertirMovimiento && !isRevertido ? (
                  <button
                    type="button"
                    css={styles.btnRevertir}
                    title={isVenta ? "Revertir esta entrega" : "Revertir esta recepción"}
                    disabled={isRevertiendo}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevertirMovimiento(mov.id, unidades, mov.producto_nombre);
                    }}
                    data-testid={`btn-revertir-stock-${mov.id}`}
                    aria-label={isVenta ? "Revertir entrega" : "Revertir recepción"}
                  >
                    <RotateCcw size={15} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  historialContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  headerButton: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  sectionTitle: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  totalBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 10,
    backgroundColor: "#eef2f6",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  chevronIcon: (isOpen: boolean) =>
    css({
      color: COLOR.TEXT.PRIMARY,
      transition: "transform 0.2s ease",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    }),
  movimientosList: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 180,
    overflowY: "auto",
  }),
  movimientoRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
  }),
  movimientoRowRevertido: css({
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    opacity: 0.65,
  }),
  movimientoInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  }),
  movimientoHeader: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  movimientoUnidades: css({
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),
  strikethrough: css({
    textDecoration: "line-through",
    color: COLOR.TEXT.TERTIARY,
  }),
  movimientoFecha: css({
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  }),
  revertidoBadge: css({
    fontSize: 11,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  movimientoDetails: css({
    display: "flex",
    fontSize: 12,
    alignItems: "center",
    color: COLOR.TEXT.SECONDARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  prodNombre: css({
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  prodCodigo: css({
    marginLeft: 4,
    color: COLOR.TEXT.TERTIARY,
  }),
  movimientoMotivo: css({
    marginLeft: 6,
    color: COLOR.TEXT.TERTIARY,
  }),
  btnRevertir: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: COLOR.TEXT.TERTIARY,
    cursor: "pointer",
    transition: "all 0.15s",
    flexShrink: 0,
    "&:hover": {
      color: COLOR.SEMANTIC.WARNING,
      background: COLOR.STATUS.WARNING.BG_SUBTLE,
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.4,
    },
  }),
} as const;
