"use client";

import React from "react";
import { css } from "@emotion/react";
import { Building2, Coins, Package, Trash } from "lucide-react";
import IconLabel from "@/app/components/ui/IconLabel";
import IconButton from "@/app/components/ui/IconButton";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatArs } from "@/lib/format";

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
  onDelete: () => void;
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

function formatDateTime24h(dateString: string): string {
  if (!dateString) return "";
  const normalized = dateString.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return dateString.slice(0, 16).replace("T", " ");
  }
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

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
}: Props) {
  const { totalLineas, totalMonto } = getTotals(operacion);

  return (
    <Card style={styles.card} onClick={onToggle}>
      <div css={styles.container}>
        <div css={styles.headerRow}>
          <div css={styles.headerLeft}>
            <div css={[styles.iconWrap, { background: tipoBg, color: tipoColor }]}>
              {tipoIcon}
            </div>
            <div css={styles.title}>{tipoLabel}</div>
          </div>
          <div css={styles.date}>{formatDateTime24h(operacion.created_at)}</div>
        </div>

        <div css={[styles.metaRow, !expanded && styles.metaRowCollapsed]}>
          <div css={[styles.metaGroup, styles.desktopOnly]}>
            <IconLabel
              icon={<Package size={18} color={COLOR.ICON.MUTED} />}
              label={`${totalLineas} productos`}
              style={styles.metaItem}
            />
            <IconLabel
              icon={<Coins size={18} color={COLOR.ICON.MUTED} />}
              label={formatArs(totalMonto)}
              style={styles.metaAmount}
            />
            <IconLabel
              icon={<Building2 size={14} color={COLOR.ICON.MUTED} />}
              label={`${tallerLabel}`}
              style={styles.metaTaller}
            />
          </div>

          <div css={[styles.metaGroup, styles.mobileOnly]}>
            <IconLabel
              icon={<Package size={18} color={COLOR.ICON.MUTED} />}
              label={`${totalLineas}`}
              style={styles.metaItem}
            />
            <IconLabel
              icon={<Coins size={18} color={COLOR.ICON.MUTED} />}
              label={formatArs(totalMonto)}
              style={styles.metaAmount}
            />
            <IconLabel
              icon={<Building2 size={14} color={COLOR.ICON.MUTED} />}
              label={`${tallerLabel}`}
              style={styles.metaTaller}
            />
          </div>

          <div css={[styles.metaActions, styles.desktopOnly]}>
            <IconButton
              icon={<Trash />}
              title="Eliminar movimiento"
              ariaLabel="Eliminar movimiento"
              hoverColor={COLOR.SEMANTIC.DANGER}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            />
          </div>

          <div css={[styles.metaActions, styles.mobileOnly]}>
            <IconButton
              icon={<Trash />}
              title="Eliminar movimiento"
              ariaLabel="Eliminar movimiento"
              hoverColor={COLOR.SEMANTIC.DANGER}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            />
          </div>
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
            <div style={styles.expandedHeaderLeft}>
              <div style={styles.expandedTitle}>Productos</div>
              <div css={styles.mobileOnly} style={styles.expandedMetaInline}>
              </div>
            </div>
          </div>
          <div style={styles.expandedList}>
            {(operacion.lineas ?? []).map((linea) => {
              const stockInfo = stocksById[linea.stock_id];
              const total = (linea.cantidad || 0) * (linea.monto_unitario || 0);
              return (
                <div key={linea.id} style={styles.expandedRow}>
                  <div style={styles.expandedLeft}>
                    <div style={styles.expandedProductName}>
                      {stockInfo?.nombre || shortId(linea.stock_id)}
                    </div>
                    <div style={styles.expandedProductMeta}>
                      {`Stock ID: ${shortId(linea.stock_id)}${stockInfo?.codigo ? ` · ${stockInfo.codigo}` : ""}`}
                    </div>
                  </div>
                  <div style={styles.expandedRight}>
                    <div style={styles.expandedQty}>x{linea.cantidad}</div>
                    <div style={styles.expandedUnit}>{formatArs(linea.monto_unitario)}</div>
                    <div style={styles.expandedTotal}>{formatArs(total)}</div>
                  </div>
                </div>
              );
            })}
          </div>
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
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      justifyContent: "space-between",
    },
  }),
  metaRowCollapsed: css({
    alignItems: "center",
    flexWrap: "nowrap",
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      flexWrap: "wrap",
    },
  }),
  metaGroup: css({
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  }),
  metaTaller: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14
  } as const,
  metaItem: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 17,
    fontWeight: 600,
  } as const,
  metaAmount: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 17,
    fontWeight: 600,
  } as const,
  metaActions: css({
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
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
    transition: "max-height 240ms ease, opacity 200ms ease, transform 200ms ease",
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
  expandedTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  expandedHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  expandedHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flexWrap: "wrap" as const,
  },
  expandedMetaInline: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  desktopOnly: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  mobileOnly: css({
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      display: "none",
    },
  }),
  expandedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  expandedRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: `1px dashed ${COLOR.BORDER.SUBTLE}`,
  },
  expandedLeft: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
  },
  expandedProductName: {
    fontWeight: 600,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  expandedProductMeta: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  expandedRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  expandedQty: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
  },
  expandedUnit: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  expandedTotal: {
    fontSize: 13,
    fontWeight: 700,
  },
} as const;
