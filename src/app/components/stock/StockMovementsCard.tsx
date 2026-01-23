"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { StockMovement } from "@/model/stock";
import { TrendingDown, TrendingUp } from "lucide-react";

type Props = {
  movimientos: StockMovement[];
};

export default function StockMovementsCard({ movimientos }: Props) {
  return (
    <div>
      <h3 style={styles.title}>Historial de movimientos</h3>
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.list}>
          {movimientos.length === 0 ? (
            <div style={styles.empty}>Sin movimientos registrados.</div>
          ) : (
            movimientos.map((mov, idx) => {
              const isEntrada = mov.tipo === "entrada";
              const color = isEntrada ? "#15803d" : COLOR.ICON.DANGER;
              const bg = isEntrada ? "rgba(21,128,61,0.10)" : "rgba(139,0,0,0.10)";
              return (
                <div key={`${mov.fecha}-${idx}`} style={styles.row}>
                  <div style={styles.left}>
                    <div style={{ ...styles.iconWrap, background: bg, color }}>
                      {isEntrada ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div>
                      <div style={styles.motivo}>{mov.motivo}</div>
                      <div style={styles.fecha}>{mov.fecha}</div>
                    </div>
                  </div>
                  <div style={{ ...styles.qty, color }}>
                    {isEntrada ? "+" : "-"}
                    {mov.cantidad} uds
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
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
  fecha: { color: COLOR.TEXT.SECONDARY, fontSize: 13 },
  qty: { fontWeight: 800, fontSize: 14, flexShrink: 0 },
} as const;

