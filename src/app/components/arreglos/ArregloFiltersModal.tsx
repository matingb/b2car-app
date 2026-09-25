"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";
import { ESTADOS_ARREGLO } from "@/model/types";
import { useTenant } from "@/app/providers/TenantProvider";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import Calendar from "@/app/components/ui/Calendar";
import { formatCalendarDateLabel } from "@/lib/fechas";

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
  const { hasPermission } = useTenant();
  const canFilterPago = hasPermission
    ? hasPermission(Permission.ArreglosPreciosView) || hasPermission(Permission.ArreglosCobrosRegister)
    : true;

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
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) return;
    onApply({
      fechaDesde,
      fechaHasta,
      patente: patente.trim(),

      estado: estado.trim(),
      estadoPago: canFilterPago ? estadoPago.trim() : "",
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
            <span style={styles.label}>Fecha desde</span>
            <div style={styles.dateControl}>
              <Calendar
                value={fechaDesde}
                onChange={setFechaDesde}
                placeholder="Seleccionar fecha..."
                dataTestId="arreglos-filter-fecha-desde"
              >
                <button type="button" data-testid="arreglos-filter-fecha-desde" aria-label="Elegir fecha desde" style={styles.calendarTrigger}>
                  {fechaDesde ? formatCalendarDateLabel(fechaDesde) : "Seleccionar fecha..."}
                </button>
              </Calendar>
              {fechaDesde ? <button type="button" aria-label="Limpiar fecha desde" style={styles.clearDate} onClick={() => setFechaDesde("")}>Limpiar</button> : null}
            </div>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Fecha hasta</span>
            <div style={styles.dateControl}>
              <Calendar
                value={fechaHasta}
                onChange={setFechaHasta}
                placeholder="Seleccionar fecha..."
                dataTestId="arreglos-filter-fecha-hasta"
              >
                <button type="button" data-testid="arreglos-filter-fecha-hasta" aria-label="Elegir fecha hasta" style={styles.calendarTrigger}>
                  {fechaHasta ? formatCalendarDateLabel(fechaHasta) : "Seleccionar fecha..."}
                </button>
              </Calendar>
              {fechaHasta ? <button type="button" aria-label="Limpiar fecha hasta" style={styles.clearDate} onClick={() => setFechaHasta("")}>Limpiar</button> : null}
            </div>
          </div>
        </div>
        {fechaDesde && fechaHasta && fechaDesde > fechaHasta ? (
          <div role="alert" style={styles.dateError}>La fecha desde debe ser anterior o igual a la fecha hasta.</div>
        ) : null}

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
          <Can anyPermissions={[Permission.ArreglosPreciosView, Permission.ArreglosCobrosRegister]}>
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
          </Can>
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
  dateControl: { display: "flex", alignItems: "center", gap: 8 },
  calendarTrigger: {
    width: "100%",
    minHeight: 42,
    textAlign: "left" as const,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    cursor: "pointer",
  },
  clearDate: {
    border: 0,
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
    padding: "6px 0",
  },
  dateError: { color: COLOR.ICON.DANGER, fontSize: 12, marginTop: 8 },
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
