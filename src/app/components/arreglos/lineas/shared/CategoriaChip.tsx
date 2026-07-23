"use client";

import React from "react";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  categoriaArregloId: string | null;
};

export default function CategoriaChip({ categoriaArregloId }: Props) {
  const { categorias } = useCategoriasArreglo();

  const nombre = categorias.find((t) => t.id === categoriaArregloId)?.nombre;
  if (!nombre) return null;

  return (
    <span style={styles.chip}>
      {nombre}
    </span>
  );
}

const styles = {
  chip: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 999,
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    whiteSpace: "nowrap" as const,
  },
} as const;
