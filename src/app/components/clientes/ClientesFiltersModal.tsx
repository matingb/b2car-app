"use client";

import { useEffect, useState, type ReactNode } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Button from "@/app/components/ui/Button";
import { BREAKPOINTS, COLOR } from "@/theme/theme";

export type ClientesFilters = {
  tipoCliente: "" | "particular" | "empresa";
  saldo: "" | "PENDIENTE" | "AL_DIA" | "A_FAVOR";
};

export const DEFAULT_CLIENTES_FILTERS: ClientesFilters = {
  tipoCliente: "",
  saldo: "",
};

type Props = {
  open: boolean;
  initial: ClientesFilters;
  onClose: () => void;
  onApply: (filters: ClientesFilters) => void;
};

export default function ClientesFiltersModal({ open, initial, onClose, onApply }: Props) {
  const [filters, setFilters] = useState<ClientesFilters>(initial);

  useEffect(() => {
    if (open) {
      setFilters(initial);
    }
  }, [initial, open]);

  if (!open) return null;

  const update = <Key extends keyof ClientesFilters>(key: Key, value: ClientesFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleClear = () => {
    setFilters(DEFAULT_CLIENTES_FILTERS);
    onApply(DEFAULT_CLIENTES_FILTERS);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Filtrar clientes"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(filters);
        onClose();
      }}
      submitText="Aplicar filtros"
    >
      <div style={styles.content}>
        <div css={styles.row}>
          <Field label="Tipo de cliente">
            <select
              data-testid="clientes-filter-tipo"
              style={styles.input}
              value={filters.tipoCliente}
              onChange={(event) =>
                update("tipoCliente", event.target.value as ClientesFilters["tipoCliente"])
              }
            >
              <option value="">Todos los tipos</option>
              <option value="particular">Particulares</option>
              <option value="empresa">Empresas</option>
            </select>
          </Field>
          <Field label="Estado de saldo">
            <select
              data-testid="clientes-filter-saldo"
              style={styles.input}
              value={filters.saldo}
              onChange={(event) =>
                update("saldo", event.target.value as ClientesFilters["saldo"])
              }
            >
              <option value="">Todos los saldos</option>
              <option value="PENDIENTE">Saldo pendiente (a cobrar)</option>
              <option value="AL_DIA">Saldo al día</option>
              <option value="A_FAVOR">Saldo a favor</option>
            </select>
          </Field>
        </div>

        <div style={styles.clearRow}>
          <Button
            type="button"
            text="Limpiar filtros"
            outline
            onClick={handleClear}
            dataTestId="clientes-filter-modal-clear"
          />
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  content: { padding: "4px 0 12px" },
  row: css({
    display: "flex",
    gap: 16,
    marginTop: 10,
    width: "auto",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: { flexDirection: "column", gap: 12 },
  }),
  field: { flex: 1, display: "flex", flexDirection: "column" as const },
  label: { fontSize: 13, marginBottom: 6, fontWeight: 600, color: COLOR.TEXT.SECONDARY },
  input: {
    width: "100%",
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
    outline: "none",
  },
  clearRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 16,
  },
};
