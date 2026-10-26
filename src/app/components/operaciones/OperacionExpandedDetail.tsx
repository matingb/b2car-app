"use client";

import React, { useState } from "react";
import { css } from "@emotion/react";
import { Check, Coins, PackageCheck } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { COLOR } from "@/theme/theme";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatArs } from "@/lib/format";
import OperacionPagoModal from "./OperacionPagoModal";
import OperacionStockConfirmModal from "./OperacionStockConfirmModal";

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
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  const isAllowedTipo =
    operacion.tipo === "COMPRA" || operacion.tipo === "VENTA" || operacion.tipo === "GASTO";
  const hasObservaciones = isAllowedTipo && Boolean(operacion.observaciones?.trim());

  const isVenta = operacion.tipo === "VENTA";
  const isCompra = operacion.tipo === "COMPRA";
  const isComercial = isVenta || isCompra;

  const tieneSaldoPendiente = (operacion.saldo_pendiente ?? 0) > 0 || operacion.estado_pago === "PENDIENTE" || operacion.estado_pago === "PARCIAL";
  const tieneStockPendiente = operacion.estado_stock === "PENDIENTE" || operacion.estado_stock === "PARCIAL";

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

  const totalCalculado = (operacion.lineas ?? []).reduce(
    (acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
    0
  );
  const totalMonto = operacion.monto_total ?? totalCalculado;
  const totalPagado = operacion.total_pagado ?? (operacion.esta_pago ? totalMonto : 0);
  const saldoPendiente = operacion.saldo_pendiente ?? Math.max(0, totalMonto - totalPagado);

  return (
    <div style={styles.expandedList}>
      {/* Banner de estado comercial para Compras y Ventas */}
      {isComercial && (
        <div style={styles.commercialSummaryCard}>
          <div style={styles.financialCol}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryItemLabel}>Total pactado</span>
              <strong style={styles.summaryItemValue}>{formatArs(totalMonto)}</strong>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryItemLabel}>{isVenta ? "Cobrado" : "Pagado"}</span>
              <span style={styles.summaryItemValue}>{formatArs(totalPagado)}</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryItemLabel}>Saldo pendiente</span>
              <strong style={{ ...styles.summaryItemValue, color: saldoPendiente > 0 ? COLOR.SEMANTIC.WARNING : COLOR.SEMANTIC.SUCCESS }}>
                {formatArs(saldoPendiente)}
              </strong>
            </div>
            {isVenta && operacion.cliente_nombre && (
              <div style={styles.summaryItem} data-testid="operacion-expanded-cliente">
                <span style={styles.summaryItemLabel}>Cliente</span>
                <span style={styles.summaryItemValue}>{operacion.cliente_nombre}</span>
              </div>
            )}
            {isCompra && operacion.proveedor_nombre && (
              <div style={styles.summaryItem} data-testid="operacion-expanded-proveedor">
                <span style={styles.summaryItemLabel}>Proveedor</span>
                <span style={styles.summaryItemValue}>{operacion.proveedor_nombre}</span>
              </div>
            )}
          </div>

          <div style={styles.actionsCol}>
            {tieneSaldoPendiente && (
              <Button
                text={isVenta ? "Registrar Cobro" : "Registrar Pago"}
                icon={<Coins size={15} />}
                onClick={() => setIsPagoModalOpen(true)}
                dataTestId="operacion-registrar-pago-btn"
                style={styles.actionBtn}
              />
            )}
            {tieneStockPendiente && (
              <Button
                text={isVenta ? "Confirmar Entrega" : "Confirmar Recepción"}
                icon={<PackageCheck size={15} />}
                onClick={() => setIsStockModalOpen(true)}
                dataTestId="operacion-confirmar-stock-btn"
                outline
                style={styles.actionBtn}
              />
            )}
          </div>
        </div>
      )}

      {/* Lista de productos / líneas */}
      {(operacion.lineas ?? []).map((linea) => {
        const stockInfo = stocksById[linea.stock_id];
        const productName =
          linea.nombre || stockInfo?.nombre || shortId(linea.stock_id);
        const productCode = linea.codigo || stockInfo?.codigo;
        const total = (linea.cantidad || 0) * (linea.monto_unitario || 0);

        const tieneEntregaParcial =
          linea.cantidad_cumplida !== undefined &&
          linea.cantidad_cumplida !== null &&
          linea.cantidad_cumplida < linea.cantidad;

        return (
          <div key={linea.id} style={styles.expandedRow}>
            <div style={styles.expandedLeft}>
              <div style={styles.expandedProductName}>
                <span>{productName}</span>
                <span style={styles.expandedProductMeta}>
                  {productCode ? ` · ${productCode}` : ""}
                </span>
              </div>
              {tieneEntregaParcial && (
                <div style={styles.cumplimientoMeta}>
                  {linea.cantidad_cumplida} de {linea.cantidad} unidades {isVenta ? "entregadas" : "recibidas"}
                </div>
              )}
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

      {isPagoModalOpen && (
        <OperacionPagoModal
          open={isPagoModalOpen}
          operacion={operacion}
          onClose={() => setIsPagoModalOpen(false)}
        />
      )}

      {isStockModalOpen && (
        <OperacionStockConfirmModal
          open={isStockModalOpen}
          operacion={operacion}
          onClose={() => setIsStockModalOpen(false)}
        />
      )}
    </div>
  );
}

const styles = {
  expandedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  commercialSummaryCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 12,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    marginBottom: 4,
  },
  financialCol: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap" as const,
  },
  summaryItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: 11,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
    fontWeight: 600,
  },
  summaryItemValue: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
  },
  actionsCol: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    height: 34,
    fontSize: 13,
    padding: "0 12px",
  },
  cumplimientoMeta: {
    fontSize: 11,
    color: COLOR.SEMANTIC.WARNING,
    fontWeight: 600,
    marginTop: 2,
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
