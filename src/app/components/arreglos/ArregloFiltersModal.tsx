"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";
import { ESTADOS_ARREGLO } from "@/model/types";

export type ArregloFilters = {
  fechaDesde: string;
  fechaHasta: string;
  patente: string;

  estado: string;
  estadoPago: string;
};

type Props = {
  open: boolean;
  initial?: Partial<ArregloFilters>;
  onClose: () => void;
  onApply: (filters: ArregloFilters) => void;
};

export default function ArregloFiltersModal({ open, initial, onClose, onApply }: Props) {
  const [fechaDesde, setFechaDesde] = useState(initial?.fechaDesde ?? "");
  const [fechaHasta, setFechaHasta] = useState(initial?.fechaHasta ?? "");
  const [patente, setPatente] = useState(initial?.patente ?? "");

  const [estado, setEstado] = useState(initial?.estado ?? "");
  const [estadoPago, setEstadoPago] = useState(initial?.estadoPago ?? "");

  useEffect(() => {
    if (!open) return;
    setFechaDesde(initial?.fechaDesde ?? "");
    setFechaHasta(initial?.fechaHasta ?? "");
    setPatente(initial?.patente ?? "");

    setEstado(initial?.estado ?? "");
    setEstadoPago(initial?.estadoPago ?? "");
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      fechaDesde,
      fechaHasta,
      patente: patente.trim(),

      estado: estado.trim(),
      estadoPago: estadoPago.trim(),
    });
    onClose();
  };



  const estadoOptions: AutocompleteOption[] = ESTADOS_ARREGLO.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  }));
  const estadoPagoOptions: AutocompleteOption[] = [
    { value: "PENDIENTE", label: "Pendiente" },
    { value: "PARCIAL", label: "Parcial" },
    { value: "PAGADO", label: "Pagado" },
  ];

  return (
    <Modal
      open={open}
      title="Filtrar arreglos"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Aplicar filtros"
    >
      <div style={{ padding: "4px 0 12px" }}>
        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Fecha desde</label>
            <input
              data-testid="arreglos-filter-fecha-desde"
              type="date"
              style={styles.input}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Fecha hasta</label>
            <input
              data-testid="arreglos-filter-fecha-hasta"
              type="date"
              style={styles.input}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Patente</label>
            <input
              data-testid="arreglos-filter-patente"
              style={styles.input}
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="ABC123"
            />
          </div>

        </div>

        <div css={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Estado</label>
            <Autocomplete
              options={estadoOptions}
              value={estado}
              onChange={setEstado}
              placeholder="EN PROGRESO, ESPERA..."
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Estado de pago</label>
            <Autocomplete
              dataTestId="arreglos-filter-estado-pago"
              options={estadoPagoOptions}
              value={estadoPago}
              onChange={setEstadoPago}
              placeholder="Pendiente, parcial o pagado"
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
