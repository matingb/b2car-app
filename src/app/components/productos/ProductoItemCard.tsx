"use client";

import React, { useMemo } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import type { Producto, StockRegistro } from "@/app/providers/InventarioProvider";

type Props = {
  producto: Producto;
  stock: StockRegistro[];
  onClick: () => void;
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

export default function ProductoItemCard({ producto, stock, onClick }: Props) {
  const talleresConStock = useMemo(() => stock.length, [stock.length]);

  return (
    <Card onClick={onClick} style={{ background: COLOR.BACKGROUND.SECONDARY }} data-testid={`producto-item-${producto.productoId}`}>
      <div style={styles.topRow}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.title}>{producto.nombre}</div>
          <div style={styles.subtitle}>{producto.codigo}</div>
        </div>
        <div style={styles.meta}>
          <span style={styles.metaText}>{talleresConStock} talleres</span>
        </div>
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.cats}>
          {producto.categorias.slice(0, 3).map((c) => (
            <CategoryTag key={c} text={c} />
          ))}
          {producto.categorias.length > 3 && <CategoryTag text={`+${producto.categorias.length - 3}`} />}
        </div>
        <div style={styles.right}>
          <div style={styles.smallMuted}>{producto.proveedor}</div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  subtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  meta: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  cats: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    minWidth: 0,
  },
  right: { display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 },
  smallMuted: { fontSize: 13, color: COLOR.TEXT.SECONDARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 320 },
} as const;

