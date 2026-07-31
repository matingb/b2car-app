"use client";

import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { finanzasClient } from "@/clients/finanzasClient";
import type { CuentaFinanciera } from "@/model/finanzas";
import type { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { isValidDate, toISODateLocal } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

type Props = {
  open: boolean;
  arregloId: string | number;
  onClose: () => void;
  onPaid?: (arreglo: Arreglo) => void;
};

/**
 * El cobro no es un toggle: solicita explÃ­citamente la cuenta y la fecha que
 * deben quedar en el asiento financiero inmutable.
 */
export default function CobroArregloModal({ open, arregloId, onClose, onPaid }: Props) {
  const { cobrar } = useArreglos();
  const { error } = useToast();
  const [cuentas, setCuentas] = useState<CuentaFinanciera[]>([]);
  const [cuentaId, setCuentaId] = useState("");
  const [fechaCobro, setFechaCobro] = useState(() => toISODateLocal(new Date()));
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCuentaId("");
    setFechaCobro(toISODateLocal(new Date()));

    let cancelled = false;
    setLoadingCuentas(true);
    void finanzasClient.listarCuentas().then((response) => {
      if (cancelled) return;
      if (response.error) {
        error("No se pudieron cargar las cuentas", response.error);
        setCuentas([]);
      } else {
        setCuentas((response.data ?? []).filter((cuenta) => cuenta.activo));
      }
    }).finally(() => {
      if (!cancelled) setLoadingCuentas(false);
    });

    return () => {
      cancelled = true;
    };
  }, [error, open]);

  const opciones = useMemo(() => cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
    secondaryLabel: cuenta.tipo.replaceAll("_", " "),
  })), [cuentas]);

  const canSubmit = Boolean(cuentaId && isValidDate(fechaCobro) && !loadingCuentas && !submitting);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const updated = await cobrar(arregloId, {
        cuenta_financiera_id: cuentaId,
        fecha_cobro: fechaCobro,
        idempotency_key: generateUuidV4(),
      });
      if (!updated) throw new Error("No se pudo registrar el cobro");
      onPaid?.(updated);
      onClose();
    } catch (cause: unknown) {
      error("No se pudo registrar el cobro", cause instanceof Error ? cause.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Registrar cobro"
      submitText="Cobrar"
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(500px, 96vw)" }}
    >
      <div css={styles.form}>
        <p css={styles.help}>
          ElegÃ­ la cuenta y la fecha que se usarÃ¡n para registrar el ingreso.
        </p>
        <label css={styles.label}>
          Cuenta financiera
          <Autocomplete
            value={cuentaId}
            onChange={setCuentaId}
            options={opciones}
            placeholder={loadingCuentas ? "Cargando cuentas..." : "Seleccionar cuenta"}
            disabled={loadingCuentas}
            hideClearButton
            dataTestId="arreglo-cobro-cuenta"
          />
        </label>
        <label css={styles.label}>
          Fecha de cobro
          <input
            type="date"
            value={fechaCobro}
            onChange={(event) => setFechaCobro(event.target.value)}
            data-testid="arreglo-cobro-fecha"
            style={styles.input}
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
  input: {
    height: 42,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    padding: "0 12px",
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
} as const;
