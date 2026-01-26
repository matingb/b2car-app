"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import StockProgressBar from "@/app/components/stock/StockProgressBar";
import { getStockStatus, getStockStatusLabel } from "@/lib/stock";

type Props = {
  tallerNombre: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
};

export default function ProductoTallerStockCard({
  tallerNombre,
  stockActual,
  stockMinimo,
  stockMaximo,
}: Props) {
  const status = useMemo(
    () => getStockStatus({ stockActual, stockMinimo, stockMaximo }),
    [stockActual, stockMinimo, stockMaximo]
  );

  return (
    <Card>
      <div style={styles.header}>
        <div style={styles.taller}>{tallerNombre}</div>
        <div style={styles.qty}>{stockActual} uds</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <StockProgressBar levels={{ stockActual, stockMinimo, stockMaximo }} height={10} />
      </div>
      <div style={styles.footer}>
        <span style={styles.muted}>
          Mín {stockMinimo} · Máx {stockMaximo}
        </span>
        <span style={{ ...styles.pill, background: pillBg(status) }}>
          {getStockStatusLabel(status)}
        </span>
      </div>
    </Card>
  );
}

function pillBg(status: ReturnType<typeof getStockStatus>) {
  if (status === "critico") return COLOR.ICON.DANGER;
  if (status === "bajo") return "#b45309";
  if (status === "alto") return COLOR.ACCENT.PRIMARY;
  return "#15803d";
}

const styles = {
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  taller: { fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  qty: { fontWeight: 600, fontSize: 14 },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  muted: { fontSize: 12, color: COLOR.TEXT.SECONDARY },
  pill: {
    padding: "4px 10px",
    borderRadius: 999,
    color: COLOR.TEXT.CONTRAST,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  },
} as const;

