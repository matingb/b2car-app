"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Dropdown from "@/app/components/ui/Dropdown";
import NumberInput from "@/app/components/ui/NumberInput";
import { COLOR } from "@/theme/theme";
import type { CrearIngresoManualInput, CuentaFinanciera } from "@/model/finanzas";
import { formatArs } from "@/lib/format";
import { parseCalendarDate, toISODateLocal, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

type Props = {
  open: boolean;
  cuentas: CuentaFinanciera[];
  cuentaId?: string;
  onClose: () => void;
  onCreate: (input: CrearIngresoManualInput) => Promise<void>;
};

const MAX_ACCOUNTING_AMOUNT = 999_999_999_999.99;

function isValidImporte(value: number): boolean {
  return Number.isFinite(value)
    && value > 0
    && value <= MAX_ACCOUNTING_AMOUNT
    && Math.abs(value * 100 - Math.round(value * 100)) <= 1e-7;
}

export default function IngresoManualFinancieroModal({ open, cuentas, cuentaId, onClose, onCreate }: Props) {
  const activeAccounts = useMemo(() => cuentas.filter((cuenta) => cuenta.activo), [cuentas]);
  const [selectedCuentaId, setSelectedCuentaId] = useState("");
  const [importe, setImporte] = useState(0);
  const [fecha, setFecha] = useState(toISODateLocal());
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(generateUuidV4());

  useEffect(() => {
    if (!open) return;
    setSelectedCuentaId(
      (cuentaId && activeAccounts.some((cuenta) => cuenta.id === cuentaId) ? cuentaId : activeAccounts[0]?.id) ?? ""
    );
    setImporte(0);
    setFecha(toISODateLocal());
    setDescripcion("");
    setSubmitting(false);
    setSubmitError(null);
    idempotencyKeyRef.current = generateUuidV4();
  }, [activeAccounts, cuentaId, open]);

  const options = useMemo(
    () => activeAccounts.map((cuenta) => ({
      value: cuenta.id,
      label: `${cuenta.nombre} · ${formatArs(cuenta.saldoActual)}`,
    })),
    [activeAccounts]
  );
  const selectedCuentaIsActive = activeAccounts.some((cuenta) => cuenta.id === selectedCuentaId);
  const canSubmit = Boolean(
    selectedCuentaIsActive && isValidImporte(importe) && parseCalendarDate(fecha) && descripcion.trim()
  );

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    const fechaCompleta = toISODateTimeWithLocalCurrentTime(fecha);
    if (!fechaCompleta) {
      setSubmitError("Elegí una fecha válida.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreate({
        cuentaId: selectedCuentaId,
        importe,
        fecha: fechaCompleta,
        descripcion: descripcion.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo registrar el ingreso manual.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nuevo ingreso manual"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      submitText="Registrar ingreso"
      submittingText="Registrando..."
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalError={submitError ? { titulo: "No se pudo registrar el ingreso", descripcion: submitError } : null}
    >
      <div style={styles.form}>
        {activeAccounts.length === 0 ? (
          <div style={styles.notice} role="status">
            No hay cuentas activas. Creá o activá una cuenta financiera antes de registrar un ingreso.
          </div>
        ) : null}

        <div style={styles.field}>
          <span style={styles.label}>Cuenta financiera</span>
          <Dropdown
            options={options}
            value={selectedCuentaId}
            onChange={(next) => {
              idempotencyKeyRef.current = generateUuidV4();
              setSelectedCuentaId(next);
            }}
            disabled={activeAccounts.length === 0}
            style={styles.dropdown}
            dataTestId="ingreso-manual-cuenta"
          />
        </div>

        <div style={styles.twoColumns}>
          <label style={styles.field}>
            <span style={styles.label}>Importe</span>
            <NumberInput
              value={importe}
              onValueChange={(next) => {
                if (next !== importe) idempotencyKeyRef.current = generateUuidV4();
                setImporte(next);
              }}
              minValue={0}
              allowDecimals
              placeholder="0"
              style={styles.input}
              data-testid="ingreso-manual-importe"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                idempotencyKeyRef.current = generateUuidV4();
                setFecha(event.target.value);
              }}
              style={styles.input}
              data-testid="ingreso-manual-fecha"
            />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>Concepto</span>
          <textarea
            value={descripcion}
            onChange={(event) => {
              idempotencyKeyRef.current = generateUuidV4();
              setDescripcion(event.target.value);
            }}
            maxLength={2_000}
            placeholder="Ej. Aporte de capital"
            style={{ ...styles.input, ...styles.textarea }}
            data-testid="ingreso-manual-descripcion"
          />
        </label>
      </div>
    </Modal>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: 14, paddingTop: 8 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6 },
  label: { color: COLOR.TEXT.SECONDARY, fontSize: 13, fontWeight: 600 },
  dropdown: { width: "100%" },
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
  textarea: { minHeight: 84, padding: 10, resize: "vertical" as const, fontFamily: "inherit" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
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
