"use client";

import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (cuentaId: string) => void | Promise<void>;
};

/** Se muestra antes de confirmar una compra de stock disparada desde un arreglo. */
export default function CuentaCompraAutomaticaModal({ open, onClose, onConfirm }: Props) {
  const { error } = useToast();
  const { cuentasActivas, loading } = useCuentasFinancieras();
  const [cuentaId, setCuentaId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCuentaId("");
  }, [open]);

  const options = useMemo(() => cuentasActivas.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
    secondaryLabel: cuenta.tipo.replaceAll("_", " "),
  })), [cuentasActivas]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cuentaId || loading || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(cuentaId);
      onClose();
    } catch (cause: unknown) {
      error("No se pudo registrar la compra", cause instanceof Error ? cause.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Registrar compra de repuesto"
      submitText="Confirmar compra"
      submitting={submitting}
      disabledSubmit={!cuentaId || loading || submitting}
      modalStyle={{ width: "min(500px, 96vw)" }}
    >
      <div css={styles.form}>
        <p css={styles.help}>
          Para cubrir el faltante se registrará una compra de stock. Elegí la cuenta desde la que se realiza el egreso.
        </p>
        <label css={styles.label}>
          Cuenta financiera
          <Autocomplete
            value={cuentaId}
            onChange={setCuentaId}
            options={options}
            placeholder={loading ? "Cargando cuentas..." : "Seleccionar cuenta"}
            disabled={loading}
            hideClearButton
            dataTestId="arreglo-compra-automatica-cuenta"
          />
        </label>
      </div>
    </Modal>
  );
}

const styles = {
  form: css({ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }),
  help: css({ margin: 0, color: COLOR.TEXT.SECONDARY, fontSize: 14, lineHeight: 1.45 }),
  label: css({ display: "flex", flexDirection: "column", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 }),
} as const;
