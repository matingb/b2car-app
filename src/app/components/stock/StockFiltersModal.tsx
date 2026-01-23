"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Dropdown, { type DropdownOption } from "@/app/components/ui/Dropdown";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import FilterChip from "@/app/components/ui/FilterChip";
import type { StockFilters } from "@/app/hooks/stock/useStockFilters";
import type { StockStatus } from "@/lib/stock";

type Props = {
  open: boolean;
  categoriasDisponibles: readonly string[];
  initial?: Partial<StockFilters>;
  onClose: () => void;
  onApply: (filters: StockFilters) => void;
};

export default function StockFiltersModal({
  open,
  categoriasDisponibles,
  initial,
  onClose,
  onApply,
}: Props) {
  const [estado, setEstado] = useState<StockStatus | "">(initial?.estado ?? "");
  const [categorias, setCategorias] = useState<string[]>(initial?.categorias ?? []);
  const [categoriaToAdd, setCategoriaToAdd] = useState("");

  useEffect(() => {
    if (!open) return;
    setEstado(initial?.estado ?? "");
    setCategorias(initial?.categorias ?? []);
    setCategoriaToAdd("");
  }, [open, initial]);

  const estadoOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "", label: "Todos" },
      { value: "critico", label: "Sin stock" },
      { value: "bajo", label: "Stock bajo" },
      { value: "normal", label: "Stock normal" },
      { value: "alto", label: "Exceso stock" },
    ],
    []
  );

  const categoriaOptions = useMemo<AutocompleteOption[]>(() => {
    // Mostrar solo las categorías no seleccionadas para facilitar multi-selección
    return categoriasDisponibles
      .filter((c) => !categorias.includes(c))
      .map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles, categorias]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      estado,
      categorias,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Filtrar stock"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Aplicar filtros"
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Estado</label>
            <Dropdown
              value={estado}
              options={estadoOptions}
              onChange={(v) => setEstado(v as StockStatus | "")}
              data-testid="stock-filter-estado"
            />
          </div>
        </div>

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
                  // Autocomplete no permite custom value por defecto, pero dejamos guardia
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
                    <FilterChip
                      key={cat}
                      text={cat}
                      selected
                      onClick={() => setCategorias((prev) => prev.filter((c) => c !== cat))}
                      data-testid={`stock-selected-categoria-${cat}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <div style={styles.hint}>
              Tip: podés seleccionar múltiples categorías.
            </div>
          </div>
        </div>

        <div style={styles.clearRow}>
          <button
            type="button"
            style={styles.clearButton}
            onClick={() => {
              setEstado("");
              setCategorias([]);
              setCategoriaToAdd("");
            }}
          >
            Limpiar selección
          </button>
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
  chips: css({
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }),
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
  hint: {
    marginTop: 8,
    fontSize: 13,
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

