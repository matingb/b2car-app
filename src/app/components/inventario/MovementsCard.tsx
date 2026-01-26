"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { StockMovementType } from "@/model/stock";

export type InventarioMovementRow = {
  fecha: string;
  tipo: StockMovementType;
  cantidad: number;
  motivo: string;
  tallerNombre?: string;
};

type Props = {
  title?: string;
  movimientos: InventarioMovementRow[];
  emptyText?: string;
};

export default function MovementsCard({
  title = "Historial de movimientos",
  movimientos,
  emptyText = "Sin movimientos registrados.",
}: Props) {
  return (
    <div>
      <h3 style={styles.title}>{title}</h3>
      {movimientos.length === 0 ? (
        <div style={styles.empty}>{emptyText}</div>
      ) : (
        <Card>
          <div style={styles.list}>
            {movimientos.map((mov, idx) => {
              const isEntrada = mov.tipo === "entrada";
              const color = isEntrada ? "#15803d" : COLOR.ICON.DANGER;
              const bg = isEntrada ? "rgba(21,128,61,0.10)" : "rgba(139,0,0,0.10)";
              return (
                <div key={`${mov.fecha}-${idx}-${mov.motivo}`} style={styles.row}>
                  <div style={styles.left}>
                    <div style={{ ...styles.iconWrap, background: bg, color }}>
                      {isEntrada ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.motivo}>{mov.motivo}</div>
                      <div style={styles.meta}>
                        <span>{mov.fecha}</span>
                        {mov.tallerNombre ? (
                          <>
                            <span style={styles.dot}>·</span>
                            <span>{mov.tallerNombre}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...styles.qty, color }}>
                    {isEntrada ? "+" : "-"}
                    {mov.cantidad} uds
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
  list: { display: "flex", flexDirection: "column" as const, gap: 10 },
  empty: { color: COLOR.TEXT.SECONDARY, fontSize: 14 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  left: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  iconWrap: {
    height: 34,
    width: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  motivo: { fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  meta: { color: COLOR.TEXT.SECONDARY, fontSize: 13, display: "flex", alignItems: "center", gap: 6 },
  dot: { opacity: 0.9 },
  qty: { fontWeight: 600, fontSize: 14, flexShrink: 0 },
} as const;

