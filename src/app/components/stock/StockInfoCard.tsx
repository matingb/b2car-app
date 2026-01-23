"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { StockItem } from "@/model/stock";

type Props = {
  item: StockItem;
  isEditing: boolean;
  draft: StockItem;
  onChange: (patch: Partial<StockItem>) => void;
};

function CategoryTag({ text }: { text: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.BACKGROUND.SUBTLE,
        fontSize: 12,
        color: COLOR.TEXT.PRIMARY,
      }}
    >
      {text}
    </span>
  );
}

export default function StockInfoCard({ item, isEditing, draft, onChange }: Props) {
  return (
    <div>
      <h3 style={styles.title}>Información general</h3>
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.grid}>
          <div>
            <div style={styles.label}>Código</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.codigo}
                onChange={(e) => onChange({ codigo: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{item.codigo}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Proveedor</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.proveedor}
                onChange={(e) => onChange({ proveedor: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{item.proveedor || "-"}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Ubicación</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.ubicacion}
                onChange={(e) => onChange({ ubicacion: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{item.ubicacion || "-"}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Última actualización</div>
            <div style={styles.value}>{item.ultimaActualizacion}</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={styles.label}>Categorías</div>
          <div style={styles.tags}>
            {item.categorias.map((c) => (
              <CategoryTag key={c} text={c} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  label: { fontSize: 13, color: COLOR.TEXT.SECONDARY, marginBottom: 6 },
  value: { fontSize: 14, fontWeight: 600 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  tags: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
} as const;

