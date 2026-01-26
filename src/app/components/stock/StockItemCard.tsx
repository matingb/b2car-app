"use client";

import React from "react";
import type { StockItem } from "@/model/stock";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import { getStockStatus } from "@/lib/stock";
import StockProgressBar from "./StockProgressBar";
import StockStatusPill from "./StockStatusPill";

type Props = {
  item: StockItem;
  onClick: (item: StockItem) => void;
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
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function StockItemCard({ item, onClick }: Props) {
  const status = getStockStatus(item);

  return (
    <Card onClick={() => onClick(item)} style={styles.card} data-testid={`stock-item-${item.id}`}>
      <div style={styles.topRow}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={styles.title}>{item.nombre}</div>
          <div style={styles.subtitle}>{item.codigo}</div>
        </div>
        <div style={styles.right}>
          <div style={styles.price}>${item.precioUnitario.toLocaleString()}</div>
        </div>
      </div>

      <div style={styles.midRow}>
        <div style={styles.cats}>
          {item.categorias.slice(0, 2).map((c) => (
            <CategoryTag key={c} text={c} />
          ))}
          {item.categorias.length > 2 && <CategoryTag text={`+${item.categorias.length - 2}`} />}
        </div>

        <div style={styles.stockCol}>
          <div style={styles.stockText}>
            <span style={{ fontWeight: 700 }}>{item.stockActual}</span>
            <span style={{ color: COLOR.TEXT.SECONDARY }}> / {item.stockMaximo}</span>
          </div>
          <StockProgressBar levels={item} height={8} />
        </div>

        <div style={styles.statusCol}>
          <StockStatusPill status={status} small />
        </div>
      </div>
    </Card>
  );
}

const styles = {
  card: {
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  subtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  price: {
    fontSize: 16,
    fontWeight: 700,
  },
  midRow: {
    display: "grid",
    gridTemplateColumns: "1fr 220px 140px",
    gap: 12,
    alignItems: "center",
    marginTop: 10,
  },
  cats: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    minWidth: 0,
  },
  stockCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  stockText: {
    fontSize: 13,
  },
  statusCol: {
    display: "flex",
    justifyContent: "flex-end",
  },
} as const;

