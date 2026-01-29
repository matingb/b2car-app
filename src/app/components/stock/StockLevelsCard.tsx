"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { StockItem } from "@/model/stock";
import { getStockStatus } from "@/lib/stock";
import StockProgressBar from "./StockProgressBar";
import StockStatusPill from "./StockStatusPill";

type Props = {
  item: StockItem;
  isEditing: boolean;
  draft: StockItem;
  onChange: (patch: Partial<StockItem>) => void;
};

export default function StockLevelsCard({ item, isEditing, draft, onChange }: Props) {
  const base = isEditing ? draft : item;
  const status = getStockStatus(base);

  return (
    <div>
      <h3 style={styles.title}>Estado del stock</h3>
      <Card>
        <div style={styles.top}>
          <div style={styles.muted}>Mín: {base.stockMinimo}</div>
          <div style={styles.center}>{base.stockActual} unidades</div>
          <div style={styles.muted}>Máx: {base.stockMaximo}</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <StockProgressBar levels={base} height={12} />
        </div>

        <div style={{ marginTop: 10 }}>
          <StockStatusPill status={status} />
        </div>

        {isEditing && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.divider} />
            <div style={styles.grid}>
              <div>
                <div style={styles.label}>Stock mínimo</div>
                <input
                  type="number"
                  style={styles.input}
                  value={draft.stockMinimo}
                  onChange={(e) => onChange({ stockMinimo: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <div style={styles.label}>Stock máximo</div>
                <input
                  type="number"
                  style={styles.input}
                  value={draft.stockMaximo}
                  onChange={(e) => onChange({ stockMaximo: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  muted: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  center: { fontSize: 18, fontWeight: 600 },
  divider: { height: 1, background: COLOR.BORDER.SUBTLE, margin: "12px 0" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  label: { fontSize: 13, color: COLOR.TEXT.SECONDARY, marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
} as const;

