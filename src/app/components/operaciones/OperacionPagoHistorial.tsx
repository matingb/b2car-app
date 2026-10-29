"use client";

import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Trash2, Wallet } from "lucide-react";
import type { OperacionPago } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";

export interface OperacionPagoHistorialProps {
  pagos?: OperacionPago[];
  tipo?: string;
  anulandoPagoId?: string | null;
  onAnularPago?: (pagoId: string, importe: number) => void;
}

export default function OperacionPagoHistorial({
  pagos,
  tipo = "VENTA",
  anulandoPagoId,
  onAnularPago,
}: OperacionPagoHistorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isVenta = tipo === "VENTA";

  const totalRegistrado = useMemo(() => {
    return pagos?.reduce((acc, item) => acc + (Number(item.monto) || 0), 0) ?? 0;
  }, [pagos]);

  if (!pagos || pagos.length === 0) {
    return null;
  }

  const sectionTitle = isVenta
    ? `Cobros registrados previamente (${pagos.length})`
    : `Pagos registrados previamente (${pagos.length})`;

  return (
    <div css={styles.historialContainer}>
      <button
        type="button"
        css={styles.headerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        data-testid="operacion-pagos-historial-toggle"
      >
        <div css={styles.headerLeft}>
          <span css={styles.sectionTitle}>{sectionTitle}</span>
          <span css={styles.totalBadge}>
            {formatArs(totalRegistrado, { maxDecimals: 0 })}
          </span>
        </div>

        <ChevronDown size={16} css={styles.chevronIcon(isOpen)} />
      </button>

      {isOpen ? (
        <div css={styles.pagosList} data-testid="operacion-pagos-historial-list">
          {pagos.map((pago) => (
            <div key={pago.id} css={styles.pagoRow}>
              <div css={styles.pagoInfo}>
                <div css={styles.pagoHeader}>
                  <span css={styles.pagoMonto}>{formatArs(pago.monto)}</span>
                  <span css={styles.pagoFecha}>
                    {formatDateLabel(pago.fecha || pago.created_at)}
                  </span>
                </div>
                <div css={styles.pagoDetails}>
                  <Wallet size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {pago.cuenta_financiera_nombre || "Cuenta financiera"}
                  {pago.descripcion ? (
                    <span css={styles.pagoDesc}>• {pago.descripcion}</span>
                  ) : null}
                </div>
              </div>

              {onAnularPago ? (
                <button
                  type="button"
                  css={styles.btnAnular}
                  title={isVenta ? "Anular este cobro" : "Anular este pago"}
                  disabled={anulandoPagoId === pago.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnularPago(pago.id, pago.monto);
                  }}
                  data-testid={`btn-anular-pago-${pago.id}`}
                  aria-label={isVenta ? "Anular cobro" : "Anular pago"}
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          ))}
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
  pagosList: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 180,
    overflowY: "auto",
  }),
  pagoRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
  }),
  pagoInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  }),
  pagoHeader: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  pagoMonto: css({
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  pagoFecha: css({
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  }),
  pagoDetails: css({
    display: "flex",
    fontSize: 12,
    alignItems: "center",
    color: COLOR.TEXT.SECONDARY,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  pagoDesc: css({
    marginLeft: 4,
    color: COLOR.TEXT.TERTIARY,
  }),
  btnAnular: css({
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
      color: COLOR.SEMANTIC.DANGER,
      background: COLOR.STATUS.DANGER.BG_SUBTLE,
    },
  }),
} as const;
