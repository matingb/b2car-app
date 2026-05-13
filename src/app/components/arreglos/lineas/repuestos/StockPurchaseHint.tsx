"use client";

import React from "react";
import { Info } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { formatMoney } from "@/app/components/arreglos/lineas/shared/lineaUtils";

type Props = {
  stockActual: number;
  faltante: number;
  precioCompra: number;
};

export default function StockPurchaseHint({
  stockActual,
  faltante,
  precioCompra,
}: Props) {
  return (
    <div style={styles.wrap}>
      <Info size={16} color={COLOR.SEMANTIC.INFO} />
      <span>
        Stock disponible: {stockActual} · Se comprarán {faltante} unidad{faltante === 1 ? "" : "es"}
        {precioCompra > 0 ? ` a ${formatMoney(precioCompra)} c/u` : ""} al guardar
      </span>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    color: COLOR.SEMANTIC.INFO,
    fontSize: 13,
    fontWeight: 700,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${COLOR.SEMANTIC.INFO}`,
    background: COLOR.BACKGROUND.INFO_TINT,
  } as const,
} as const;
