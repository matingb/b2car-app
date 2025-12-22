"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";

export type ArregloFilters = {
  fechaDesde: string;
  fechaHasta: string;
  patente: string;
  tipo: string;
};

type Props = {
  open: boolean;
  initial?: Partial<ArregloFilters>;
  onClose: () => void;
  onApply: (filters: ArregloFilters) => void;
};

const emptyFilters: ArregloFilters = {
  fechaDesde: "",
  fechaHasta: "",
  patente: "",
  tipo: "",
};

export default function ArregloFiltersModal({ open, initial, onClose, onApply }: Props) {
  const [fechaDesde, setFechaDesde] = useState(initial?.fechaDesde ?? "");
  const [fechaHasta, setFechaHasta] = useState(initial?.fechaHasta ?? "");
  const [patente, setPatente] = useState(initial?.patente ?? "");
  const [tipo, setTipo] = useState(initial?.tipo ?? "");

  useEffect(() => {
    if (!open) return;
    setFechaDesde(initial?.fechaDesde ?? "");
    setFechaHasta(initial?.fechaHasta ?? "");
    setPatente(initial?.patente ?? "");
    setTipo(initial?.tipo ?? "");
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      fechaDesde,
      fechaHasta,
      patente: patente.trim(),
      tipo: tipo.trim(),
    });
    onClose();
  };

  const handleClear = () => {
    setFechaDesde("");
    setFechaHasta("");
    setPatente("");
    setTipo("");
    onApply(emptyFilters);
    onClose();
  };

  const opcionesDefault: AutocompleteOption[] = [
    { value: "Mecanica", label: "Mecanica" },
    { value: "Chapa y pintura", label: "Chapa y pintura" },
    { value: "Electricidad", label: "Electricidad" },
    { value: "Mantenimiento", label: "Mantenimiento" },
    { value: "Revision", label: "Revision" },
  ];

  return (
    <Modal
      open={open}
      title="Filtrar arreglos"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Aplicar"
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Fecha desde</label>
            <input type="date" style={styles.input} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Fecha hasta</label>
            <input type="date" style={styles.input} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Patente</label>
            <input
              style={styles.input}
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="ABC123"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Tipo de arreglo</label>
            <Autocomplete
              options={opcionesDefault}
              value={tipo}
              onChange={setTipo}
              placeholder="Mecanica, Chapa y pintura..."
              allowCustomValue
            />
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
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
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
