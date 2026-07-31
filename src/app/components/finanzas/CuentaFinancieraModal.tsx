"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { COLOR } from "@/theme/theme";
import type { TipoCuentaFinanciera } from "@/model/finanzas";
import { CUENTA_TIPOS, getCuentaTipoLabel, normalizeMoneyInput } from "./finanzasUtils";

export type CuentaFinancieraDraft = {
  nombre: string;
  tipo: TipoCuentaFinanciera;
  saldoInicial: number;
  activo: boolean;
};

type Props = {
  open: boolean;
  title?: string;
  initialValues?: Partial<CuentaFinancieraDraft> | null;
  showSaldoInicial?: boolean;
  showActivo?: boolean;
  onClose: () => void;
  onSave: (draft: CuentaFinancieraDraft) => Promise<void>;
};

const EMPTY_DRAFT: CuentaFinancieraDraft = {
  nombre: "",
  tipo: "EFECTIVO",
  saldoInicial: 0,
  activo: true,
};

function buildDraft(initialValues?: Partial<CuentaFinancieraDraft> | null): CuentaFinancieraDraft {
  return {
    ...EMPTY_DRAFT,
    ...initialValues,
    nombre: initialValues?.nombre?.trim() ?? "",
    tipo: (initialValues?.tipo?.toUpperCase() as TipoCuentaFinanciera | undefined) || "EFECTIVO",
    saldoInicial: Number(initialValues?.saldoInicial) || 0,
    activo: initialValues?.activo ?? true,
  };
}

export default function CuentaFinancieraModal({
  open,
  title = "Nueva cuenta",
  initialValues,
  showSaldoInicial = true,
  showActivo = true,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<CuentaFinancieraDraft>(() => buildDraft(initialValues));
  const [saldoInicialText, setSaldoInicialText] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = buildDraft(initialValues);
    setDraft(next);
    setSaldoInicialText(String(next.saldoInicial));
    setSubmitError(null);
    setSubmitting(false);
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    return Boolean(draft.nombre.trim()) && Boolean(draft.tipo);
  }, [draft.nombre, draft.tipo]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({
        ...draft,
        nombre: draft.nombre.trim(),
        saldoInicial: normalizeMoneyInput(saldoInicialText),
      });
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo guardar la cuenta.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      submitText="Guardar"
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalError={
        submitError
          ? { titulo: "No se pudo guardar la cuenta", descripcion: submitError }
          : null
      }
    >
      <div style={styles.form}>
        <label style={styles.field}>
          <span style={styles.label}>Nombre de la cuenta</span>
          <input
            autoFocus
            value={draft.nombre}
            onChange={(event) => setDraft((previous) => ({ ...previous, nombre: event.target.value }))}
            placeholder="Ej. Caja principal"
            style={styles.input}
            data-testid="cuenta-financiera-nombre"
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Tipo</span>
          <select
            value={draft.tipo}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                tipo: event.target.value as TipoCuentaFinanciera,
              }))
            }
            style={styles.input}
            data-testid="cuenta-financiera-tipo"
          >
            {CUENTA_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {getCuentaTipoLabel(tipo)}
              </option>
            ))}
          </select>
        </label>

        {showSaldoInicial ? (
          <label style={styles.field}>
            <span style={styles.label}>Saldo inicial</span>
            <input
              inputMode="decimal"
              value={saldoInicialText}
              onChange={(event) => setSaldoInicialText(event.target.value)}
              placeholder="0"
              style={styles.input}
              data-testid="cuenta-financiera-saldo-inicial"
            />
            <span style={styles.hint}>
              Se usa como punto de partida para calcular el saldo actual.
            </span>
          </label>
        ) : null}

        {showActivo ? (
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={draft.activo}
              onChange={(event) => setDraft((previous) => ({ ...previous, activo: event.target.checked }))}
              data-testid="cuenta-financiera-activa"
            />
            <span>
              <strong style={styles.checkTitle}>Cuenta activa</strong>
              <span style={styles.checkHelp}>
                Las cuentas inactivas se conservan para consulta, pero no se pueden usar en nuevos movimientos.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    paddingTop: 8,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    width: "100%",
    minHeight: 42,
    boxSizing: "border-box" as const,
    padding: "0 12px",
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    borderRadius: 8,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
  },
  hint: {
    color: COLOR.TEXT.TERTIARY,
    fontSize: 12,
    lineHeight: 1.4,
  },
  checkRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    cursor: "pointer",
  },
  checkTitle: {
    display: "block",
    fontSize: 14,
  },
  checkHelp: {
    display: "block",
    marginTop: 3,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    lineHeight: 1.35,
  },
} as const;
