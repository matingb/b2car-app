"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import CuentaFinancieraFormFields, {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "./CuentaFinancieraFormFields";

export type { CuentaFinancieraDraft };

type Props = {
  open: boolean;
  title?: string;
  initialValues?: Partial<CuentaFinancieraDraft> | null;
  showSaldoInicial?: boolean;
  showActivo?: boolean;
  onClose: () => void;
  onSave: (draft: CuentaFinancieraDraft) => Promise<void>;
};

function buildDraft(initialValues?: Partial<CuentaFinancieraDraft> | null): CuentaFinancieraDraft {
  return {
    ...EMPTY_CUENTA_FINANCIERA_DRAFT,
    ...initialValues,
    nombre: initialValues?.nombre?.trim() ?? "",
    tipo: (initialValues?.tipo?.toUpperCase() as CuentaFinancieraDraft["tipo"] | undefined) || "EFECTIVO",
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = buildDraft(initialValues);
    setDraft(next);
    setSubmitError(null);
    setSubmitting(false);
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    return validateCuentaFinancieraForm(draft);
  }, [draft]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({
        ...draft,
        nombre: draft.nombre.trim(),
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
      modalStyle={{ width: "min(520px, 96vw)" }}
      modalError={
        submitError
          ? { titulo: "No se pudo guardar la cuenta", descripcion: submitError }
          : null
      }
    >
      <div style={styles.form}>
        <CuentaFinancieraFormFields
          values={draft}
          onChange={(patch) => setDraft((previous) => ({ ...previous, ...patch }))}
          showSaldoInicial={showSaldoInicial}
          showActivo={showActivo}
        />
      </div>
    </Modal>
  );
}

const styles = {
  form: {
    paddingTop: 8,
  },
} as const;
