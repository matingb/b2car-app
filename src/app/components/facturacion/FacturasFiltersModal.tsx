"use client";

import { useEffect, useState, type ReactNode } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import { FACTURA_ESTADO_LABEL } from "@/lib/facturacion/types";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Calendar from "@/app/components/ui/Calendar";
import { formatCalendarDateLabel } from "@/lib/fechas";

export type FacturasFilters = {
  estado: string;
  ambiente: string;
  documentoTipo: string;
  desde: string;
  hasta: string;
};

type Props = {
  open: boolean;
  initial: FacturasFilters;
  onClose: () => void;
  onApply: (filters: FacturasFilters) => void;
};

export default function FacturasFiltersModal({ open, initial, onClose, onApply }: Props) {
  const [filters, setFilters] = useState<FacturasFilters>(initial);

  useEffect(() => {
    if (open) setFilters(initial);
  }, [initial, open]);

  if (!open) return null;

  const update = <Key extends keyof FacturasFilters>(key: Key, value: FacturasFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <Modal
      open={open}
      title="Filtrar comprobantes"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (filters.desde && filters.hasta && filters.desde > filters.hasta) return;
        onApply(filters);
        onClose();
      }}
      submitText="Aplicar filtros"
    >
      <div style={styles.content}>
        <div css={styles.row}>
          <Field label="Estado">
            <select data-testid="facturas-filter-estado" style={styles.input} value={filters.estado} onChange={(event) => update("estado", event.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(FACTURA_ESTADO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Ambiente">
            <select data-testid="facturas-filter-ambiente" style={styles.input} value={filters.ambiente} onChange={(event) => update("ambiente", event.target.value)}>
              <option value="">Todos los ambientes</option>
              <option value="HOMOLOGACION">Homologación</option>
              <option value="PRODUCCION">Producción</option>
            </select>
          </Field>
        </div>
        <div css={styles.row}>
          <Field label="Fecha desde">
            <div style={styles.dateControl}>
              <Calendar value={filters.desde} onChange={(value) => update("desde", value)} placeholder="Seleccionar fecha..." dataTestId="facturas-filter-desde">
                <button type="button" data-testid="facturas-filter-desde" aria-label="Elegir fecha desde" style={styles.calendarTrigger}>
                  {filters.desde ? formatCalendarDateLabel(filters.desde) : "Seleccionar fecha..."}
                </button>
              </Calendar>
              {filters.desde ? <button type="button" aria-label="Limpiar fecha desde" style={styles.clearDate} onClick={() => update("desde", "")}>Limpiar</button> : null}
            </div>
          </Field>
          <Field label="Fecha hasta">
            <div style={styles.dateControl}>
              <Calendar value={filters.hasta} onChange={(value) => update("hasta", value)} placeholder="Seleccionar fecha..." dataTestId="facturas-filter-hasta">
                <button type="button" data-testid="facturas-filter-hasta" aria-label="Elegir fecha hasta" style={styles.calendarTrigger}>
                  {filters.hasta ? formatCalendarDateLabel(filters.hasta) : "Seleccionar fecha..."}
                </button>
              </Calendar>
              {filters.hasta ? <button type="button" aria-label="Limpiar fecha hasta" style={styles.clearDate} onClick={() => update("hasta", "")}>Limpiar</button> : null}
            </div>
          </Field>
        </div>
        {filters.desde && filters.hasta && filters.desde > filters.hasta ? (
          <div role="alert" style={styles.dateError}>La fecha desde debe ser anterior o igual a la fecha hasta.</div>
        ) : null}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>;
}

const styles = {
  content: { padding: "4px 0 12px" },
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: { flexDirection: "column", gap: 8 },
  }),
  field: { flex: 1, display: "flex", flexDirection: "column" as const },
  label: { fontSize: 13, marginBottom: 6, color: COLOR.TEXT.SECONDARY },
  input: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
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
} as const;
