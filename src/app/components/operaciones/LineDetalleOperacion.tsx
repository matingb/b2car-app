"use client";

import React from "react";
import { css } from "@emotion/react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatDateTimeLabel } from "@/lib/fechas";
import {
  getOperacionTitle,
  useOperacionDetalle,
} from "./useOperacionDetalle";
import OperacionMeta from "./OperacionMeta";
import OperacionActions from "./OperacionActions";
import OperacionExpandedDetail from "./OperacionExpandedDetail";

export { getOperacionTitle };

type Props = {
  operacion: Operacion;
  tipoLabel: string;
  tipoIcon: React.ReactNode;
  tipoColor: string;
  tipoBg: string;
  tallerLabel: string;
  stocksById: Record<string, StockItem>;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
};

export default function LineDetalleOperacion({
  operacion,
  tipoLabel,
  tipoIcon,
  tipoColor,
  tipoBg,
  tallerLabel,
  stocksById,
  expanded,
  onToggle,
  onDelete,
  onEdit,
}: Props) {
  const {
    title,
    isGasto,
    isMovimientoFinanciero,
    totalMonto,
    metaBadge,
    accountOrWorkshop,
    deleteTitle,
  } = useOperacionDetalle({
    operacion,
    tipoLabel,
    tallerLabel,
    stocksById,
  });

  return (
    <Card style={styles.card} onClick={onToggle}>
      <div css={styles.container}>
        <div css={styles.headerRow}>
          <div css={styles.headerLeft}>
            <div
              css={[
                styles.iconWrap,
                { background: tipoBg, color: tipoColor },
              ]}
            >
              {tipoIcon}
            </div>
            <div css={styles.title}>{title}</div>
          </div>
          <div css={styles.date}>{formatDateTimeLabel(operacion.fecha)}</div>
        </div>

        <div css={[styles.metaRow, !expanded && styles.metaRowCollapsed]}>
          <OperacionMeta
            metaBadge={metaBadge}
            accountOrWorkshop={accountOrWorkshop}
            totalMonto={totalMonto}
          />
          <OperacionActions
            isGasto={isGasto}
            deleteTitle={deleteTitle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.expandedPanel,
          ...(expanded ? styles.expandedPanelOpen : styles.expandedPanelClosed),
        }}
      >
        <div style={styles.expandedContainer}>
          <div style={styles.expandedHeader}>
            <div style={styles.expandedTitle}>
              {isMovimientoFinanciero
                ? "Detalle del movimiento"
                : "Productos"}
            </div>
          </div>
          <OperacionExpandedDetail
            operacion={operacion}
            stocksById={stocksById}
            isMovimientoFinanciero={isMovimientoFinanciero}
          />
        </div>
      </div>
    </Card>
  );
}

const styles = {
  card: {
    cursor: "pointer",
  } as const,
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
  }),
  headerRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  }),
  iconWrap: css({
    height: 44,
    width: 44,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      height: "auto",
      width: "auto",
      borderRadius: 0,
      background: "transparent !important",
      padding: 0,
    },
  }),
  title: css({
    fontSize: 16,
    fontWeight: 600,
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      fontSize: 18,
    },
  }),
  date: css({
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
  metaRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  }),
  metaRowCollapsed: css({
    alignItems: "center",
    flexWrap: "nowrap",
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      flexWrap: "wrap",
    },
  }),
  expandedContainer: {
    marginTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingTop: 12,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  expandedPanel: {
    overflow: "hidden",
    transition:
      "max-height 240ms ease, opacity 200ms ease, transform 200ms ease",
    transformOrigin: "top",
  },
  expandedPanelOpen: {
    maxHeight: 600,
    opacity: 1,
    transform: "translateY(0)",
  },
  expandedPanelClosed: {
    maxHeight: 0,
    opacity: 0,
    transform: "translateY(-4px)",
    pointerEvents: "none",
  },
  expandedHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
} as const;
