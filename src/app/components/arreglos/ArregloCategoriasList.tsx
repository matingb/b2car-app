"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";

export type CategoriaItem = {
  id: string;
  nombre: string;
};

type Props = {
  categorias: (CategoriaItem | undefined | null)[];
  limit?: number; // 0 for no limit
  emptyText?: string;
  size?: "sm" | "md";
};

export default function ArregloCategoriasList({ categorias, limit = 3, emptyText, size = "sm" }: Props) {
  const validCategorias = categorias.filter((t): t is CategoriaItem => Boolean(t));

  if (validCategorias.length === 0) {
    if (emptyText) {
      return <span style={styles.emptyText}>{emptyText}</span>;
    }
    return null;
  }

  const displayed = limit > 0 ? validCategorias.slice(0, limit) : validCategorias;
  const remaining = limit > 0 ? validCategorias.length - limit : 0;

  return (
    <div style={styles.container(size)}>
      {displayed.map((t) => (
        <span key={t.id} css={styles.chip(size)}>
          {t.nombre}
        </span>
      ))}
      {remaining > 0 && (
        <span css={styles.chip(size)} title={`${remaining} categorías más`}>
          +{remaining}
        </span>
      )}
    </div>
  );
}

const styles = {
  container: (size: "sm" | "md") => ({
    display: "flex",
    gap: size === "sm" ? 4 : 8,
    flexWrap: "wrap" as const,
  }),
  chip: (size: "sm" | "md") => css({
    padding: size === "sm" ? "2px 8px" : "6px 12px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: size === "sm" ? 12 : 14,
    fontWeight: 500,
    borderRadius: size === "sm" ? 6 : 8,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  }),
  emptyText: {
    fontSize: 14,
    color: COLOR.TEXT.TERTIARY,
    fontStyle: "italic",
  },
} as const;
