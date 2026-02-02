"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Dropdown, { type DropdownOption } from "@/app/components/ui/Dropdown";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";
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

  useEffect(() => {
    if (!open) return;
    setEstado(initial?.estado ?? "");
    setCategorias(initial?.categorias ?? []);
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

  const categoriaOptions = useMemo(() => {
    return categoriasDisponibles.map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles]);

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
            <DropdownMultiSelect
              options={categoriaOptions}
              value={categorias}
              onChange={setCategorias}
              placeholder="Seleccionar categorías..."
              dataTestId="stock-filter-categorias"
            />
          </div>
        </div>

        <div style={styles.clearRow}>
          <button
            type="button"
            style={styles.clearButton}
            onClick={() => {
              setEstado("");
              setCategorias([]);
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

