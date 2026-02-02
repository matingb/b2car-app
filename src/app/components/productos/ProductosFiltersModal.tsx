"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";
import type { ProductosFilters } from "@/app/hooks/productos/useProductosFilters";

type Props = {
  open: boolean;
  categoriasDisponibles: readonly string[];
  initial?: Partial<ProductosFilters>;
  onClose: () => void;
  onApply: (filters: ProductosFilters) => void;
};

export default function ProductosFiltersModal({
  open,
  categoriasDisponibles,
  initial,
  onClose,
  onApply,
}: Props) {
  const [categorias, setCategorias] = useState<string[]>(initial?.categorias ?? []);

  useEffect(() => {
    if (!open) return;
    setCategorias(initial?.categorias ?? []);
  }, [open, initial]);

  const categoriaOptions = useMemo(() => {
    return categoriasDisponibles.map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({ categorias });
    onClose();
  };

  return (
    <Modal open={open} title="Filtrar productos" onClose={onClose} onSubmit={handleSubmit} submitText="Aplicar filtros">
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Categorías</label>
            <DropdownMultiSelect
              options={categoriaOptions}
              value={categorias}
              onChange={setCategorias}
              placeholder="Seleccionar categorías..."
            />

            <div style={styles.clearRow}>
              <button type="button" style={styles.clearButton} onClick={() => setCategorias([])}>
                Limpiar selección
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexDirection: "column",
      gap: 8,
    },
  }),
  field: { flex: 1 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  clearRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  clearButton: {
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
} as const;

