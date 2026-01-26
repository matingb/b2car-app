"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import type { Producto } from "@/app/providers/ProductosProvider";
import { Box, Tag } from "lucide-react";
import { css } from "@emotion/react";

type Props = {
  producto: Producto;
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

export default function ProductoItemCard({ producto, onClick }: Props) {
  const talleresConStock = producto.talleresConStock ?? 0;
  const categorias = producto.categorias ?? [];
  const categoriaPrincipal = categorias[0] ?? "Sin categoría";

  return (
    <Card
      onClick={onClick}
      data-testid={`producto-item-${producto.id}`}
    >
      <div style={styles.container}>
        <div style={styles.leftGroup}>
          <div style={styles.iconBadge}>
            <Box size={18} color={COLOR.TEXT.CONTRAST} />
          </div>

          <div style={styles.details}>
            <div style={styles.title}>{producto.nombre}</div>
            <div style={styles.subtitle}>{producto.codigo}</div>


          </div>
        </div>

        <div css={styles.right}>
          <div style={styles.rightInfo}>
            <span style={styles.metaText}>{talleresConStock} talleres</span>
            <span style={styles.metaDot}>•</span>
            <span style={styles.metaText}>{producto.proveedor || "Sin proveedor"}</span>
          </div>
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
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: COLOR.ACCENT.PRIMARY,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  infoText: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 220,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap" as const,
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
  right: css({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: 'none',
    },
  }),
  rightInfo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
  },
} as const;

