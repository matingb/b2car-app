"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatArs } from "@/lib/format";

type Props = {
  operacion: Operacion;
  stocksById: Record<string, StockItem>;
  isMovimientoFinanciero: boolean;
};

function shortId(value: string) {
  if (!value) return "-";
  return value.slice(0, 8).toUpperCase();
}

export default function OperacionExpandedDetail({
  operacion,
  stocksById,
  isMovimientoFinanciero,
}: Props) {
  const isAllowedTipo =
    operacion.tipo === "COMPRA" || operacion.tipo === "VENTA" || operacion.tipo === "GASTO";
  const hasObservaciones = isAllowedTipo && Boolean(operacion.observaciones?.trim());

  if (isMovimientoFinanciero) {
    return (
      <div style={styles.expandedExpense}>
        <div style={styles.expandedExpenseDescription}>
          {operacion.descripcion || "Sin descripción"}
        </div>
        <div style={styles.expandedExpenseMeta}>
          {[operacion.categoria_gasto, operacion.cuenta_financiera_nombre]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {hasObservaciones && (
          <div style={styles.observacionesSection} data-testid="operacion-expanded-observaciones">
            <div style={styles.observacionesTitle}>Observaciones</div>
            <div style={styles.observacionesContent}>{operacion.observaciones}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.expandedList}>
      {(operacion.lineas ?? []).map((linea) => {
        const stockInfo = stocksById[linea.stock_id];
        const productName =
          linea.nombre || stockInfo?.nombre || shortId(linea.stock_id);
        const productCode = linea.codigo || stockInfo?.codigo;
        const total = (linea.cantidad || 0) * (linea.monto_unitario || 0);

        return (
          <div key={linea.id} style={styles.expandedRow}>
            <div style={styles.expandedLeft}>
              <div style={styles.expandedProductName}>
                <span>{productName}</span>
                <span style={styles.expandedProductMeta}>
                  {productCode ? ` · ${productCode}` : ""}
                </span>
              </div>
            </div>
            <div style={styles.expandedRight}>
              <div style={styles.expandedQty}>x{linea.cantidad}</div>
              <div style={styles.expandedUnit}>
                {formatArs(linea.monto_unitario)}
              </div>
              <div style={styles.expandedTotal}>{formatArs(total)}</div>
            </div>
          </div>
        );
      })}
      {hasObservaciones && (
        <div style={styles.observacionesSection} data-testid="operacion-expanded-observaciones">
          <div style={styles.observacionesTitle}>Observaciones</div>
          <div style={styles.observacionesContent}>{operacion.observaciones}</div>
        </div>
      )}
    </div>
  );
}

const styles = {
  expandedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  expandedExpense: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    padding: "8px 0",
  },
  expandedExpenseDescription: {
    fontWeight: 600,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  expandedExpenseMeta: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
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
  observacionesSection: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column" as const,
  },
  observacionesTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: COLOR.TEXT.SECONDARY,
  },
  observacionesContent: {
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "pre-wrap" as const,
    lineHeight: 1.5,
  },
} as const;
