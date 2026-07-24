"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Producto } from "@/app/providers/ProductosProvider";
import { css } from "@emotion/react";
import { getProductoStockSummary } from "@/app/hooks/productos/useProductosFilters";
import StockStatusIcon from "@/app/components/stock/StockStatusIcon";

type Props = {
  producto: Producto;
  tallerId?: string;
  onClick: () => void;
};

function CategoryTag({ text }: { text: string }) {
  return (
    <span style={styles.categoryTag}>
      {text}
    </span>
  );
}

export default function ProductoItemCard({ producto, tallerId = "", onClick }: Props) {
  const summary = getProductoStockSummary(producto, tallerId);
  const categorias = producto.categorias ?? [];

  return (
    <Card onClick={onClick} data-testid={`producto-item-${producto.id}`}>
      <div style={styles.container}>
        <div style={styles.leftGroup}>
          <StockStatusIcon status={summary.worstStatus} />

          <div style={styles.details}>
            <div style={styles.title}>{producto.nombre}</div>
            <div style={styles.subtitle}>
              {producto.codigo} · Stock total: {summary.stockTotal}
            </div>
          </div>
        </div>

        <div css={styles.right}>
          <div style={styles.cats}>
            {categorias.slice(0, 2).map((c) => (
              <CategoryTag key={c} text={c} />
            ))}
            {categorias.length > 2 && <CategoryTag text={`+${categorias.length - 2}`} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  leftGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    cursor: "pointer",
  },
  details: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
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
  metaText: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
  },
  metaDot: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  },
  cats: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    minWidth: 0,
  },
  categoryTag: {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    fontSize: 12,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap" as const,
  },
  right: css({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
} as const;
