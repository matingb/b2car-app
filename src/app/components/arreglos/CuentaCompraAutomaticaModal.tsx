"use client";

import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import CuentaFinancieraFormFields, {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import CuentaFinancieraAutocomplete, {
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/CuentaFinancieraAutocomplete";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";
import { useTenant } from "@/app/providers/TenantProvider";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (cuentaId: string) => void | Promise<void>;
};

export { CREATE_CUENTA_VALUE };

/** Se muestra antes de confirmar una compra de stock disparada desde un arreglo. */
export default function CuentaCompraAutomaticaModal({ open, onClose, onConfirm }: Props) {
  const { hasPermission } = useTenant();
  const canCreateCuenta = hasPermission(Permission.FinanzasEdit);
  const { error, success } = useToast();
  const { loading, createCuenta, cuentaFavorita } = useCuentasFinancieras();
  const [cuentaId, setCuentaId] = useState("");
  const [cuentaDraft, setCuentaDraft] = useState<CuentaFinancieraDraft>(() => ({ ...EMPTY_CUENTA_FINANCIERA_DRAFT }));
  const [submitting, setSubmitting] = useState(false);

  const isCreatingCuenta = canCreateCuenta && cuentaId === CREATE_CUENTA_VALUE;

  useEffect(() => {
    if (!open) return;
    setCuentaId("");
    setCuentaDraft({ ...EMPTY_CUENTA_FINANCIERA_DRAFT });
  }, [open]);

  useEffect(() => {
    if (!open || cuentaId || !cuentaFavorita?.id) return;
    setCuentaId(cuentaFavorita.id);
  }, [open, cuentaId, cuentaFavorita]);

  const isValid = useMemo(() => {
    if (loading || submitting) return false;
    if (!cuentaId) return false;
    if (isCreatingCuenta) return validateCuentaFinancieraForm(cuentaDraft);
    return true;
  }, [loading, submitting, cuentaId, isCreatingCuenta, cuentaDraft]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      let finalCuentaId = cuentaId;
      if (isCreatingCuenta) {
        const created = await createCuenta({
          nombre: cuentaDraft.nombre.trim(),
          tipo: cuentaDraft.tipo,
          saldoInicial: 0,
        });
        success("Cuenta creada", `${created.nombre} se registró correctamente.`);
        finalCuentaId = created.id;
      }
      await onConfirm(finalCuentaId);
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
      disabledSubmit={!isValid}
      modalStyle={{ width: "min(520px, 96vw)" }}
    >
      <div css={styles.form}>
        <p css={styles.help}>
          Para cubrir el faltante se registrará una compra de stock. Elegí la cuenta desde la que se realiza el egreso.
        </p>

        <label css={styles.label}>
          Cuenta financiera
          <CuentaFinancieraAutocomplete
            value={cuentaId}
            onChange={setCuentaId}
            disabled={loading}
            allowCreate={canCreateCuenta}
            hideClearButton
            dataTestId="arreglo-compra-automatica-cuenta"
          />
        </label>

        {isCreatingCuenta && (
          <Can permission={Permission.FinanzasEdit}>
            <CuentaFinancieraFormFields
              values={cuentaDraft}
              onChange={(patch) => setCuentaDraft((prev) => ({ ...prev, ...patch }))}
              showSaldoInicial={false}
              showActivo={false}
              compact
              dataTestIdPrefix="compra-automatica-cuenta"
            />
          </Can>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  form: css({ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }),
  help: css({ margin: 0, color: COLOR.TEXT.SECONDARY, fontSize: 14, lineHeight: 1.45 }),
  label: css({ display: "flex", flexDirection: "column", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 }),
  inlineForm: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
  }),
} as const;
