"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Dropdown from "@/app/components/ui/Dropdown";
import NumberInput from "@/app/components/ui/NumberInput";
import { COLOR } from "@/theme/theme";
import type { CuentaFinanciera } from "@/model/finanzas";
import { toLocalISODate } from "./finanzasUtils";

export type TransferenciaFinancieraDraft = {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  importe: number;
  fecha: string;
  descripcion: string;
};

type Props = {
  open: boolean;
  cuentas: CuentaFinanciera[];
  cuentaOrigenId?: string;
  onClose: () => void;
  onCreate: (draft: TransferenciaFinancieraDraft) => Promise<void>;
};

export default function TransferenciaFinancieraModal({
  open,
  cuentas,
  cuentaOrigenId,
  onClose,
  onCreate,
}: Props) {
  const activeAccounts = useMemo(() => cuentas.filter((cuenta) => cuenta.activo), [cuentas]);
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [importe, setImporte] = useState<number>(0);
  const [fecha, setFecha] = useState(toLocalISODate());
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const defaultOrigen =
      (cuentaOrigenId && activeAccounts.some((cuenta) => cuenta.id === cuentaOrigenId)
        ? cuentaOrigenId
        : activeAccounts[0]?.id) ?? "";
    const defaultDestino = activeAccounts.find((cuenta) => cuenta.id !== defaultOrigen)?.id ?? "";
    setOrigenId(defaultOrigen);
    setDestinoId(defaultDestino);
    setImporte(0);
    setFecha(toLocalISODate());
    setDescripcion("");
    setSubmitError(null);
    setSubmitting(false);
  }, [activeAccounts, cuentaOrigenId, open]);

  const origenOptions = useMemo(
    () => activeAccounts.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre })),
    [activeAccounts]
  );

  const destinoOptions = useMemo(
    () =>
      activeAccounts
        .filter((cuenta) => cuenta.id !== origenId)
        .map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre })),
    [activeAccounts, origenId]
  );

  const canSubmit = Boolean(origenId && destinoId && origenId !== destinoId && importe > 0 && fecha);
  const originIsFixed = Boolean(cuentaOrigenId);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate({
        cuentaOrigenId: origenId,
        cuentaDestinoId: destinoId,
        importe,
        fecha,
        descripcion: descripcion.trim(),
      });
      onClose();
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo registrar la transferencia."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nueva transferencia"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      submitText="Transferir"
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalError={
        submitError
          ? { titulo: "No se pudo registrar la transferencia", descripcion: submitError }
          : null
      }
    >
      <div style={styles.form}>
        {activeAccounts.length < 2 ? (
          <div style={styles.notice} role="status">
            Necesitás al menos dos cuentas activas para registrar una transferencia.
          </div>
        ) : null}

        <div style={styles.field}>
          <span style={styles.label}>Desde</span>
          <Dropdown
            options={origenOptions}
            value={origenId}
            onChange={(next) => {
              setOrigenId(next);
              if (next === destinoId) {
                setDestinoId(activeAccounts.find((cuenta) => cuenta.id !== next)?.id ?? "");
              }
            }}
            disabled={originIsFixed}
            style={styles.dropdown}
            dataTestId="transferencia-cuenta-origen"
          />
        </div>

        <div style={styles.field}>
          <span style={styles.label}>Hacia</span>
          <Dropdown
            options={destinoOptions}
            value={destinoId}
            onChange={(next) => setDestinoId(next)}
            style={styles.dropdown}
            dataTestId="transferencia-cuenta-destino"
          />
        </div>

        <div style={styles.twoColumns}>
          <div style={styles.field}>
            <span style={styles.label}>Importe</span>
            <NumberInput
              value={importe}
              onValueChange={setImporte}
              minValue={0}
              allowDecimals
              placeholder="0"
              style={styles.input}
              data-testid="transferencia-importe"
            />
          </div>

          <label style={styles.field}>
            <span style={styles.label}>Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              style={styles.input}
              data-testid="transferencia-fecha"
            />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>Descripción (opcional)</span>
          <textarea
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Ej. Movimiento de caja al banco"
            style={{ ...styles.input, ...styles.textarea }}
            data-testid="transferencia-descripcion"
          />
        </label>
      </div>
    </Modal>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
    paddingTop: 8,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 600,
  },
  dropdown: {
    width: "100%",
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
  textarea: {
    minHeight: 84,
    padding: 10,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  notice: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 10,
    color: COLOR.TEXT.SECONDARY,
    background: COLOR.BACKGROUND.WARNING_TINT,
    fontSize: 13,
    lineHeight: 1.4,
  },
} as const;
