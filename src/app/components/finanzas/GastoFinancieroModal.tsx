"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import CuentaFinancieraAutocomplete, { CREATE_CUENTA_VALUE } from "./CuentaFinancieraAutocomplete";
import CuentaFinancieraFormFields, {
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
  type CuentaFinancieraDraft,
} from "./CuentaFinancieraFormFields";
import GastoFormFields from "./GastoFormFields";
import { generateUuidV4 } from "@/lib/uuid";
import { parseCalendarDate, toISODateLocal, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import {
  CATEGORIAS_GASTO,
  type CrearCuentaFinancieraInput,
  type CrearGastoFinancieroInput,
  type CuentaFinanciera,
} from "@/model/finanzas";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  cuentas: CuentaFinanciera[];
  cuentaId: string;
  onClose: () => void;
  onCreate: (input: CrearGastoFinancieroInput) => Promise<void>;
  onCreateCuenta: (input: CrearCuentaFinancieraInput) => Promise<CuentaFinanciera>;
};

type GastoAttempt = {
  signature: string;
  payload: CrearGastoFinancieroInput;
};

const CATEGORY_VALUES = new Set(CATEGORIAS_GASTO.map((categoria) => categoria.value));

export default function GastoFinancieroModal({
  open,
  cuentas,
  cuentaId,
  onClose,
  onCreate,
  onCreateCuenta,
}: Props) {
  const activeAccounts = useMemo(() => cuentas.filter((cuenta) => cuenta.activo), [cuentas]);
  const [selectedCuentaId, setSelectedCuentaId] = useState("");
  const [cuentaDraft, setCuentaDraft] = useState<CuentaFinancieraDraft>(() => ({ ...EMPTY_CUENTA_FINANCIERA_DRAFT }));
  const [categoriaGasto, setCategoriaGasto] = useState("ALQUILER");
  const [montoGasto, setMontoGasto] = useState("");
  const [fecha, setFecha] = useState(toISODateLocal());
  const [descripcionGasto, setDescripcionGasto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(generateUuidV4());
  const attemptedGastoRef = useRef<GastoAttempt | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedCuentaId(cuentaId);
    setCuentaDraft({ ...EMPTY_CUENTA_FINANCIERA_DRAFT });
    setCategoriaGasto("ALQUILER");
    setMontoGasto("");
    setFecha(toISODateLocal());
    setDescripcionGasto("");
    setSubmitting(false);
    setSubmitError(null);
    idempotencyKeyRef.current = generateUuidV4();
    attemptedGastoRef.current = null;
  }, [cuentaId, open]);

  const isCreatingCuenta = selectedCuentaId === CREATE_CUENTA_VALUE;
  const hasValidCuenta = isCreatingCuenta
    ? validateCuentaFinancieraForm(cuentaDraft)
    : activeAccounts.some((cuenta) => cuenta.id === selectedCuentaId);
  const canSubmit = Boolean(
    hasValidCuenta
      && CATEGORY_VALUES.has(categoriaGasto as (typeof CATEGORIAS_GASTO)[number]["value"])
      && Number.isFinite(Number(montoGasto))
      && Number(montoGasto) > 0
      && parseCalendarDate(fecha),
  );

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let targetCuentaId = selectedCuentaId;
      if (isCreatingCuenta) {
        const created = await onCreateCuenta({
          nombre: cuentaDraft.nombre.trim(),
          tipo: cuentaDraft.tipo,
          saldoInicial: 0,
        });
        targetCuentaId = created.id;
        setSelectedCuentaId(created.id);
      }

      const signature = JSON.stringify({
        cuentaId: targetCuentaId,
        categoria: categoriaGasto,
        importe: Number(montoGasto),
        fecha,
        descripcion: descripcionGasto.trim() || null,
      });
      const previousAttempt = attemptedGastoRef.current;
      let payload = previousAttempt?.signature === signature ? previousAttempt.payload : null;
      if (!payload) {
        const fechaCompleta = toISODateTimeWithLocalCurrentTime(fecha);
        if (!fechaCompleta) {
          setSubmitError("Elegí una fecha válida.");
          return;
        }
        idempotencyKeyRef.current = generateUuidV4();
        payload = {
          cuentaId: targetCuentaId,
          categoria: categoriaGasto,
          importe: Number(montoGasto),
          fecha: fechaCompleta,
          descripcion: descripcionGasto.trim() || null,
          idempotencyKey: idempotencyKeyRef.current,
        };
        attemptedGastoRef.current = { signature, payload };
      }

      await onCreate(payload);
      onClose();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo registrar el gasto.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Nuevo gasto"
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      submitText="Registrar gasto"
      submittingText="Registrando..."
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(760px, 96vw)" }}
      modalError={submitError ? { titulo: "No se pudo registrar el gasto", descripcion: submitError } : null}
    >
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Cuenta financiera</label>
          <CuentaFinancieraAutocomplete
            value={selectedCuentaId}
            onChange={setSelectedCuentaId}
            cuentas={cuentas}
            dataTestId="gasto-cuenta-financiera"
            hideClearButton
            style={{ height: 44, fontSize: 14 }}
          />
        </div>
        {isCreatingCuenta ? (
          <CuentaFinancieraFormFields
            values={cuentaDraft}
            onChange={(patch) => setCuentaDraft((previous) => ({ ...previous, ...patch }))}
            showSaldoInicial={false}
            showActivo={false}
            compact
            dataTestIdPrefix="gasto-cuenta"
          />
        ) : null}
        <GastoFormFields
          categoriaGasto={categoriaGasto}
          setCategoriaGasto={setCategoriaGasto}
          montoGasto={montoGasto}
          setMontoGasto={setMontoGasto}
          descripcionGasto={descripcionGasto}
          setDescripcionGasto={setDescripcionGasto}
        />
        <div style={styles.field}>
          <label style={styles.label} htmlFor="gasto-fecha">Fecha</label>
          <input
            id="gasto-fecha"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            data-testid="gasto-fecha"
            style={styles.dateInput}
          />
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: 12, paddingTop: 8 },
  field: { display: "flex", flexDirection: "column" as const, gap: 6 },
  label: { display: "block", fontSize: 13, color: COLOR.TEXT.SECONDARY, marginBottom: 6 },
  dateInput: {
    height: 44,
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  } as const,
} as const;
