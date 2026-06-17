"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import DropdownMultiSelect from "@/app/components/ui/DropdownMultiSelect";
import type { ProductosFilters } from "@/app/hooks/productos/useProductosFilters";
import Autocomplete from "@/app/components/ui/Autocomplete";
import Dropdown from "@/app/components/ui/Dropdown";
import type { Taller } from "@/model/types";

type Props = {
  open: boolean;
  categoriasDisponibles: readonly string[];
  talleres: Taller[];
  initial?: Partial<ProductosFilters>;
  onClose: () => void;
  onApply: (filters: ProductosFilters) => void;
};

export default function ProductosFiltersModal({
  open,
  categoriasDisponibles,
  talleres,
  initial,
  onClose,
  onApply,
}: Props) {
  const [categorias, setCategorias] = useState<string[]>(initial?.categorias ?? []);
  const [tallerId, setTallerId] = useState(initial?.tallerId ?? "");
  const [estado, setEstado] = useState<ProductosFilters["estado"]>(initial?.estado ?? "");
  const [visibilidad, setVisibilidad] = useState<ProductosFilters["visibilidad"]>(
    initial?.visibilidad ?? "inventario"
  );

  useEffect(() => {
    if (!open) return;
    setCategorias(initial?.categorias ?? []);
    setTallerId(initial?.tallerId ?? "");
    setEstado(initial?.estado ?? "");
    setVisibilidad(initial?.visibilidad ?? "inventario");
  }, [open, initial]);

  const categoriaOptions = useMemo(() => {
    return categoriasDisponibles.map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({ categorias, tallerId, estado, visibilidad });
    onClose();
  };

  return (
    <Modal open={open} title="Filtrar productos" onClose={onClose} onSubmit={handleSubmit} submitText="Aplicar filtros">
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Taller</label>
            <Autocomplete
              options={[
                { value: "", label: "Todos los talleres" },
                ...talleres.map((t) => ({ value: t.id, label: t.nombre })),
              ]}
              value={tallerId}
              onChange={setTallerId}
              placeholder="Todos los talleres"
            />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Estado de stock</label>
            <Dropdown
              value={estado}
              onChange={(value) => setEstado(value as ProductosFilters["estado"])}
              options={[
                { value: "", label: "Todos" },
                { value: "critico", label: "Sin stock" },
                { value: "bajo", label: "Stock bajo" },
                { value: "normal", label: "Stock normal" },
                { value: "alto", label: "Exceso stock" },
              ]}
              style={{ width: "100%", height: 40 }}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Visibilidad</label>
            <Dropdown
              value={visibilidad}
              onChange={(value) => setVisibilidad(value as ProductosFilters["visibilidad"])}
              options={[
                { value: "inventario", label: "Mostrar en inventario" },
                { value: "esporadico", label: "Stock esporadico" },
                { value: "todos", label: "Todos" },
              ]}
              style={{ width: "100%", height: 40 }}
            />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Categorias</label>
            <DropdownMultiSelect
              options={categoriaOptions}
              value={categorias}
              onChange={setCategorias}
              placeholder="Seleccionar categorias..."
            />

            <div style={styles.clearRow}>
              <button
                type="button"
                style={styles.clearButton}
                onClick={() => {
                  setCategorias([]);
                  setTallerId("");
                  setEstado("");
                  setVisibilidad("inventario");
                }}
              >
                Limpiar filtros
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
