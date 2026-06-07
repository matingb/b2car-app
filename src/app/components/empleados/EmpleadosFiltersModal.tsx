"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import NumberInput from "@/app/components/ui/NumberInput";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import type { Taller } from "@/model/types";
import type { EmpleadosFilters } from "@/app/hooks/empleados/useEmpleadosFilters";

type Props = {
  open: boolean;
  talleres: Taller[];
  showTallerFilter: boolean;
  initial?: Partial<EmpleadosFilters>;
  onClose: () => void;
  onApply: (filters: EmpleadosFilters) => void;
};

const DEFAULT_FILTERS: EmpleadosFilters = {
  tallerId: "",
  salarioMin: null,
  salarioMax: null,
  cumpleanosDesde: "",
  cumpleanosHasta: "",
};

export default function EmpleadosFiltersModal({
  open,
  talleres,
  showTallerFilter,
  initial,
  onClose,
  onApply,
}: Props) {
  const [tallerId, setTallerId] = useState<string>(initial?.tallerId ?? "");
  const [salarioMin, setSalarioMin] = useState<number | null>(initial?.salarioMin ?? null);
  const [salarioMax, setSalarioMax] = useState<number | null>(initial?.salarioMax ?? null);
  const [cumpleanosDesde, setCumpleanosDesde] = useState<string>(initial?.cumpleanosDesde ?? "");
  const [cumpleanosHasta, setCumpleanosHasta] = useState<string>(initial?.cumpleanosHasta ?? "");

  useEffect(() => {
    if (!open) return;
    setTallerId(initial?.tallerId ?? "");
    setSalarioMin(initial?.salarioMin ?? null);
    setSalarioMax(initial?.salarioMax ?? null);
    setCumpleanosDesde(initial?.cumpleanosDesde ?? "");
    setCumpleanosHasta(initial?.cumpleanosHasta ?? "");
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      tallerId,
      salarioMin,
      salarioMax,
      cumpleanosDesde,
      cumpleanosHasta,
    });
    onClose();
  };

  const handleClear = () => {
    setTallerId("");
    setSalarioMin(null);
    setSalarioMax(null);
    setCumpleanosDesde("");
    setCumpleanosHasta("");
    onApply(DEFAULT_FILTERS);
  };

  return (
    <Modal
      open={open}
      title="Filtrar empleados"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Aplicar filtros"
    >
      <div style={{ padding: "4px 0 12px" }}>
        {showTallerFilter && (
          <div css={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Taller</label>
              <select
                style={styles.input}
                value={tallerId}
                onChange={(e) => setTallerId(e.target.value)}
              >
                <option value="">Todos los talleres</option>
                {talleres.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Salario mínimo</label>
            <NumberInput
              minValue={0}
              value={salarioMin ?? 0}
              onValueChange={(next) => setSalarioMin(next > 0 ? next : null)}
              placeholder="0"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Salario máximo</label>
            <NumberInput
              minValue={0}
              value={salarioMax ?? 0}
              onValueChange={(next) => setSalarioMax(next > 0 ? next : null)}
              placeholder="0"
            />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Nacimiento desde</label>
            <input
              type="date"
              style={styles.input}
              value={cumpleanosDesde}
              onChange={(e) => setCumpleanosDesde(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Nacimiento hasta</label>
            <input
              type="date"
              style={styles.input}
              value={cumpleanosHasta}
              onChange={(e) => setCumpleanosHasta(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.clearRow}>
          <button type="button" style={styles.clearButton} onClick={handleClear}>
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
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
    outline: "none",
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
