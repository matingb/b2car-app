"use client";

import React, { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import CuentaFinancieraAutocomplete, {
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/CuentaFinancieraAutocomplete";
import CuentaFinancieraFormFields, {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import type { Operacion } from "@/model/types";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { toISODateLocal, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";

interface Props {
  open: boolean;
  operacion: Operacion | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OperacionPagoModal({
  open,
  operacion,
  onClose,
  onSuccess,
}: Props) {
  const { registrarPago } = useOperaciones();
  const { cuentaFavorita, createCuenta } = useCuentasFinancieras();
  const { success, error } = useToast();

  const [cuentaId, setCuentaId] = useState("");
  const [cuentaDraft, setCuentaDraft] = useState<CuentaFinancieraDraft>(() => ({ ...EMPTY_CUENTA_FINANCIERA_DRAFT }));
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => toISODateLocal(new Date()));
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const saldoPendiente = operacion?.saldo_pendiente ?? 0;
  const isVenta = operacion?.tipo === "VENTA";
  const isCreatingCuenta = cuentaId === CREATE_CUENTA_VALUE;

  const cuentaFavoritaId = cuentaFavorita?.id;
  const operacionId = operacion?.id;

  useEffect(() => {
    if (!open || !operacion) return;
    setCuentaId(cuentaFavoritaId ?? "");
    setMonto(saldoPendiente > 0 ? String(saldoPendiente) : "");
    setFecha(toISODateLocal(new Date()));
    setDescripcion("");
    setCuentaDraft({ ...EMPTY_CUENTA_FINANCIERA_DRAFT });
  }, [open, operacionId, saldoPendiente, cuentaFavoritaId]);

  const montoNum = Number(monto);
  const isValid =
    Boolean(cuentaId) &&
    (!isCreatingCuenta || validateCuentaFinancieraForm(cuentaDraft)) &&
    Number.isFinite(montoNum) &&
    montoNum > 0 &&
    (saldoPendiente <= 0 || montoNum <= saldoPendiente);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !operacion) return;

    setSubmitting(true);
    try {
      let finalCuentaId = cuentaId;
      if (isCreatingCuenta) {
        const created = await createCuenta({
          nombre: cuentaDraft.nombre.trim(),
          tipo: cuentaDraft.tipo,
          saldoInicial: 0,
        });
        finalCuentaId = created.id;
      }

      const fechaIso = toISODateTimeWithLocalCurrentTime(fecha) ?? new Date().toISOString();
      const ok = await registrarPago(operacion.id, {
        cuentaId: finalCuentaId,
        monto: montoNum,
        fecha: fechaIso,
        descripcion: descripcion.trim() || undefined,
      });

      if (ok) {
        success(
          isVenta ? "Cobro registrado" : "Pago registrado",
          `Se registró exitosamente el ${isVenta ? "cobro" : "pago"} de ${formatArs(montoNum)}.`
        );
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar el pago";
      error("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!operacion) return null;

  return (
    <Modal
      open={open}
      title={isVenta ? "Registrar Cobro" : "Registrar Pago"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={isVenta ? "Confirmar Cobro" : "Confirmar Pago"}
      submitting={submitting}
      disabledSubmit={!isValid}
      modalStyle={{ width: "min(520px, 96vw)" }}
    >
      <div style={styles.container}>
        {/* Resumen de saldo */}
        <div style={styles.summaryCard}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Total acordado:</span>
            <strong style={styles.summaryValue}>{formatArs(operacion.monto_total ?? 0)}</strong>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>{isVenta ? "Total cobrado:" : "Total pagado:"}</span>
            <span style={styles.summaryValue}>{formatArs(operacion.total_pagado ?? 0)}</span>
          </div>
          <div style={styles.summaryRowHighlight}>
            <span style={styles.summaryLabelHighlight}>Saldo pendiente:</span>
            <strong style={styles.summaryValueHighlight}>{formatArs(saldoPendiente)}</strong>
          </div>
        </div>

        {/* Cuenta financiera */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Cuenta financiera <span style={styles.required}>*</span>
          </label>
          <CuentaFinancieraAutocomplete
            value={cuentaId}
            onChange={setCuentaId}
            dataTestId="operacion-pago-modal-cuenta"
            style={{ height: 44, fontSize: 14 }}
          />
        </div>

        {isCreatingCuenta && (
          <CuentaFinancieraFormFields
            values={cuentaDraft}
            onChange={(patch) => setCuentaDraft({ ...cuentaDraft, ...patch })}
            showSaldoInicial={false}
            showActivo={false}
            compact
            dataTestIdPrefix="operacion-pago-cuenta"
          />
        )}

        {/* Monto y Fecha */}
        <div style={styles.twoCols}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Monto a {isVenta ? "cobrar" : "pagar"} ($) <span style={styles.required}>*</span>
            </label>
            <input
              type="number"
              min="0.01"
              max={saldoPendiente > 0 ? saldoPendiente : undefined}
              step="any"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              style={styles.input}
              data-testid="operacion-pago-modal-monto"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={styles.input}
              data-testid="operacion-pago-modal-fecha"
            />
          </div>
        </div>

        {/* Descripción / Observación */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Detalle / Referencia (opcional)</label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Transferencia bancaria #4819"
            style={styles.input}
            data-testid="operacion-pago-modal-descripcion"
          />
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: "8px 0",
  },
  summaryCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "12px 14px",
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  summaryLabel: {
    color: COLOR.TEXT.SECONDARY,
  },
  summaryValue: {
    color: COLOR.TEXT.PRIMARY,
  },
  summaryRowHighlight: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    fontWeight: 600,
    marginTop: 4,
    paddingTop: 6,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  summaryLabelHighlight: {
    color: COLOR.TEXT.PRIMARY,
  },
  summaryValueHighlight: {
    color: COLOR.SEMANTIC.WARNING,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    width: "100%",
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
  },
  input: {
    height: 44,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
};
