"use client";

import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import Modal from "@/app/components/ui/Modal";
import Autocomplete from "@/app/components/ui/Autocomplete";
import { useToast } from "@/app/providers/ToastProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { finanzasClient } from "@/clients/finanzasClient";
import type { CuentaFinanciera, GastoFinanciero } from "@/model/finanzas";
import { COLOR } from "@/theme/theme";
import { isValidDate, toISODateLocal } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

export const CATEGORIAS_GASTO = [
  { value: "ALQUILER", label: "Alquiler" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "SUELDOS_HONORARIOS", label: "Sueldos y honorarios" },
  { value: "IMPUESTOS", label: "Impuestos" },
  { value: "INSUMOS_REPUESTOS", label: "Insumos y repuestos" },
  { value: "HERRAMIENTAS_EQUIPAMIENTO", label: "Herramientas y equipamiento" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "TRANSPORTE_COMBUSTIBLE", label: "Transporte y combustible" },
  { value: "MARKETING_PUBLICIDAD", label: "Marketing y publicidad" },
  { value: "COMISIONES_GASTOS_BANCARIOS", label: "Comisiones y gastos bancarios" },
  { value: "OTROS", label: "Otros" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (gasto: GastoFinanciero) => void;
  cuentaPreseleccionadaId?: string | null;
  gasto?: GastoFinanciero | null;
};

function getInitialDate(gasto?: GastoFinanciero | null) {
  return gasto?.fecha ? gasto.fecha.slice(0, 10) : toISODateLocal(new Date());
}

export default function GastoModal({
  open,
  onClose,
  onSaved,
  cuentaPreseleccionadaId,
  gasto,
}: Props) {
  const { success, error } = useToast();
  const { cuentas, loading: loadingCuentas } = useCuentasFinancieras();
  const [submitting, setSubmitting] = useState(false);
  const [cuentaId, setCuentaId] = useState("");
  const [categoria, setCategoria] = useState<string>("ALQUILER");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(() => getInitialDate(gasto));
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    if (!open) return;
    setCuentaId(gasto?.cuentaId ?? cuentaPreseleccionadaId ?? "");
    setCategoria(gasto?.categoria ?? "ALQUILER");
    setImporte(gasto ? String(gasto.importe) : "");
    setFecha(getInitialDate(gasto));
    setDescripcion(gasto?.descripcion ?? "");
  }, [open, gasto, cuentaPreseleccionadaId]);

  const cuentasElegibles = useMemo(
    () => cuentas.filter((cuenta) => cuenta.activo || cuenta.id === gasto?.cuentaId),
    [cuentas, gasto?.cuentaId]
  );
  const importeNumero = Number(importe);
  const canSubmit = Boolean(
    cuentaId &&
      categoria &&
      descripcion.trim() &&
      Number.isFinite(importeNumero) &&
      importeNumero > 0 &&
      isValidDate(fecha) &&
      !loadingCuentas
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    const payload = {
      cuentaId,
      categoria,
      importe: importeNumero,
      fecha,
      descripcion: descripcion.trim(),
      idempotencyKey: generateUuidV4(),
    };

    try {
      const response = gasto
        ? await finanzasClient.actualizarGasto(gasto.id, payload)
        : await finanzasClient.crearGasto(payload);
      if (response.error || !response.data) throw new Error(response.error || "No se pudo guardar el gasto");
      onSaved?.(response.data);
      success(gasto ? "Gasto actualizado" : "Gasto registrado", "El movimiento financiero se guardó correctamente.");
      onClose();
    } catch (cause: unknown) {
      error("No se pudo guardar el gasto", cause instanceof Error ? cause.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={gasto ? "Editar gasto" : "Nuevo gasto"}
      onSubmit={handleSubmit}
      submitText={gasto ? "Guardar cambios" : "Registrar gasto"}
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(560px, 96vw)" }}
    >
      <div css={styles.form}>
        <label css={styles.label}>
          Cuenta financiera
          <Autocomplete
            value={cuentaId}
            onChange={setCuentaId}
            options={cuentasElegibles.map((cuenta) => ({
              value: cuenta.id,
              label: cuenta.activo ? cuenta.nombre : `${cuenta.nombre} (inactiva)`,
              secondaryLabel: `Saldo: $${Number(cuenta.saldoActual ?? 0).toLocaleString("es-AR")}`,
            }))}
            placeholder={loadingCuentas ? "Cargando cuentas..." : "Seleccionar cuenta"}
            disabled={loadingCuentas}
            hideClearButton
            dataTestId="gasto-cuenta"
          />
        </label>
        <label css={styles.label}>
          Categoría
          <Autocomplete
            value={categoria}
            onChange={setCategoria}
            options={[...CATEGORIAS_GASTO]}
            hideClearButton
            dataTestId="gasto-categoria"
          />
        </label>
        <div css={styles.row}>
          <label css={styles.label}>
            Monto
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={importe}
              onChange={(event) => setImporte(event.target.value)}
              data-testid="gasto-importe"
              style={styles.input}
            />
          </label>
          <label css={styles.label}>
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              data-testid="gasto-fecha"
              style={styles.input}
            />
          </label>
        </div>
        <label css={styles.label}>
          Descripción
          <textarea
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={3}
            data-testid="gasto-descripcion"
            style={styles.textarea}
          />
        </label>
      </div>
    </Modal>
  );
}

const styles = {
  form: css({ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }),
  row: css({ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }),
  label: css({ display: "flex", flexDirection: "column", gap: 6, color: COLOR.TEXT.SECONDARY, fontSize: 13 }),
  input: {
    height: 42,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    padding: "0 12px",
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
  textarea: {
    resize: "vertical" as const,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    padding: 12,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.PRIMARY,
    fontFamily: "inherit",
  } as const,
} as const;
