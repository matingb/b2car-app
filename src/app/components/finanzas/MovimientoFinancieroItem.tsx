"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { MovimientoFinanciero } from "@/model/finanzas";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";

type Props = {
  movimiento: MovimientoFinanciero;
  isLast?: boolean;
  onClick?: () => void;
};

const LABELS: Record<string, string> = {
  APERTURA_CUENTA: "Saldo inicial",
  GASTO: "Gasto",
  COBRO_ARREGLO: "Cobro de arreglo",
  COMPRA_STOCK: "Compra de stock",
  VENTA_STOCK: "Venta de stock",
  REVERSO: "Reverso",
};

const ICONS: Record<string, React.ReactNode> = {
  APERTURA_CUENTA: <CircleDollarSign size={17} />,
  GASTO: <ReceiptText size={17} />,
  COBRO_ARREGLO: <CircleDollarSign size={17} />,
  COMPRA_STOCK: <ShoppingCart size={17} />,
  VENTA_STOCK: <TrendingUp size={17} />,
  REVERSO: <RotateCcw size={17} />,
};

function getMovementPresentation(tipo: string, importe: number) {
  if (tipo === "TRANSFERENCIA") {
    return importe < 0
      ? { label: "Transferencia enviada", icon: <ArrowUpRight size={17} /> }
      : { label: "Transferencia recibida", icon: <ArrowDownLeft size={17} /> };
  }
  const label = LABELS[tipo];
  if (label) return { label, icon: ICONS[tipo] ?? <CircleDollarSign size={17} /> };
  return {
    label: importe < 0 ? "Egreso" : "Ingreso",
    icon: <CircleDollarSign size={17} />,
  };
}

export default function MovimientoFinancieroItem({
  movimiento,
  isLast = false,
  onClick,
}: Props) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const importe = Number(movimiento.importe) || 0;
  const isIncome = importe >= 0;
  const presentation = getMovementPresentation(movimiento.tipo, importe);
  const color = isIncome ? COLOR.SEMANTIC.SUCCESS : COLOR.ICON.DANGER;
  const background = isIncome
    ? COLOR.BACKGROUND.SUCCESS_TINT
    : COLOR.BACKGROUND.DANGER_TINT;
  const categoria = movimiento.categoria?.replaceAll("_", " ").toLowerCase();

  return (
    <div
      style={{
        ...styles.row,
        ...(isLast ? styles.lastRow : {}),
      }}
    >
      <div style={styles.rowLeft}>
        <div css={styles.iconWrap} style={{ color, background }}>
          {presentation.icon}
        </div>
        <div style={styles.copy}>
          <div style={styles.description}>
            {movimiento.descripcion || presentation.label}
          </div>
          <div style={styles.meta}>
            <span>{formatDateLabel(movimiento.fecha)}</span>
            <span style={styles.dot}>·</span>
            <span>{presentation.label}</span>
            {categoria ? (
              <>
                <span style={styles.dot}>·</span>
                <span style={styles.category}>{categoria}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <strong style={{ ...styles.amount, color }}>
        {isIncome ? "+ " : "- "}
        {formatArs(Math.abs(importe))}
      </strong>
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "11px 8px",
    margin: "0 -8px",
    borderRadius: 8,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    transition: "background-color 0.15s ease",
  },
  clickable: {
    cursor: "pointer",
  },
  hovered: {
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  },
  lastRow: {
    borderBottom: "none",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  iconWrap: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 999,
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  copy: { minWidth: 0 },
  description: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    fontWeight: 600,
    fontSize: 14,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 5,
    marginTop: 3,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  },
  dot: { opacity: 0.65 },
  category: { textTransform: "capitalize" as const },
  amount: {
    flexShrink: 0,
    fontSize: 14,
    whiteSpace: "nowrap" as const,
  },
};
