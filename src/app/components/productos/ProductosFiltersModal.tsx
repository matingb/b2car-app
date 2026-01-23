"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import FilterChip from "@/app/components/ui/FilterChip";
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
  const [categoriaToAdd, setCategoriaToAdd] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategorias(initial?.categorias ?? []);
    setCategoriaToAdd("");
  }, [open, initial]);

  const categoriaOptions = useMemo<AutocompleteOption[]>(() => {
    return categoriasDisponibles
      .filter((c) => !categorias.includes(c))
      .map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles, categorias]);

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
            <Autocomplete
              options={categoriaOptions}
              value={categoriaToAdd}
              onChange={(value) => {
                if (!value) {
                  setCategoriaToAdd("");
                  return;
                }
                if (!categoriasDisponibles.includes(value)) {
                  setCategoriaToAdd("");
                  return;
                }
                setCategorias((prev) => (prev.includes(value) ? prev : [...prev, value]));
                setCategoriaToAdd("");
              }}
              placeholder="Buscar categoría..."
            />

            {categorias.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={styles.selectedLabel}>Seleccionadas</div>
                <div css={styles.selectedChips}>
                  {categorias.map((cat) => (
                    <FilterChip key={cat} text={cat} selected onClick={() => setCategorias((prev) => prev.filter((c) => c !== cat))} />
                  ))}
                </div>
              </div>
            )}

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
  selectedLabel: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  selectedChips: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }),
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

