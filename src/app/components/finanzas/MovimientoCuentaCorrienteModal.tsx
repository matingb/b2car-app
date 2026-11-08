"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
import {
  type PagoDraftItem,
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/useCondicionPago";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { clientesClient } from "@/clients/clientes/clientesClient";
import type { SentidoMovimientoCuentaCorriente } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import {
  isValidDate,
  toISODateAppTimeZone,
  toISODateTimeWithLocalCurrentTime,
} from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

export type EntidadCuentaCorriente = "PROVEEDOR" | "CLIENTE";

export type MovimientoCuentaCorrienteModalProps = {
  open: boolean;
  entidad: EntidadCuentaCorriente;
  contraparteId: string;
  contraparteNombre: string;
  saldoActual: number;
  initialSentido?: SentidoMovimientoCuentaCorriente;
  onClose: () => void;
  onSuccess: () => void;
};

const MAX_AMOUNT = 999_999_999_999.99;

function isValidMonto(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_AMOUNT &&
    Math.abs(value * 100 - Math.round(value * 100)) <= 1e-7
  );
}

function getDefaultSentido(entidad: EntidadCuentaCorriente): SentidoMovimientoCuentaCorriente {
  return entidad === "PROVEEDOR" ? "PAGO" : "COBRO";
}

function getDefaultMontoForSentido(
  entidad: EntidadCuentaCorriente,
  sentido: SentidoMovimientoCuentaCorriente,
  saldoActual: number
): string {
  const isReductorDeuda = sentido === getDefaultSentido(entidad);
  if (isReductorDeuda) {
    return saldoActual > 0 ? String(saldoActual) : "";
  }
  return saldoActual < 0 ? String(Math.abs(saldoActual)) : "";
}

export default function MovimientoCuentaCorrienteModal({
  open,
  entidad,
  contraparteId,
  contraparteNombre,
  saldoActual,
  initialSentido,
  onClose,
  onSuccess,
}: MovimientoCuentaCorrienteModalProps) {
  const cuentasCtx = useCuentasFinancieras();
  const { loading: loadingCuentas, cuentaFavorita, createCuenta } = cuentasCtx;
  const toast = useToast();

  const resolvedInitialSentido = initialSentido ?? getDefaultSentido(entidad);
  const [sentido, setSentido] = useState<SentidoMovimientoCuentaCorriente>(resolvedInitialSentido);
  const [pagosDraft, setPagosDraft] = useState<PagoDraftItem[]>([
    {
      id: generateUuidV4(),
      cuentaId: "",
      monto: "",
      fecha: toISODateAppTimeZone(),
      descripcion: "",
    },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [observaciones, setObservaciones] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(generateUuidV4());
  const prevOpenRef = useRef(false);

  const initDraft = useCallback(
    (targetSentido: SentidoMovimientoCuentaCorriente) => {
      const favoriteId = cuentaFavorita?.id ?? "";
      const hasFav = Boolean(favoriteId);
      const defaultMonto = getDefaultMontoForSentido(entidad, targetSentido, saldoActual);
      setShowAdvanced(!hasFav || !defaultMonto);
      setPagosDraft([
        {
          id: generateUuidV4(),
          cuentaId: favoriteId,
          monto: defaultMonto,
          fecha: toISODateAppTimeZone(),
          descripcion: "",
        },
      ]);
    },
    [cuentaFavorita, entidad, saldoActual]
  );

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return;
    prevOpenRef.current = true;

    setSentido(resolvedInitialSentido);
    initDraft(resolvedInitialSentido);
    setObservaciones("");
    setSubmitting(false);
    setErrorMsg(null);
    idempotencyKeyRef.current = generateUuidV4();
  }, [initDraft, open, resolvedInitialSentido]);

  const handleSentidoChange = (nextSentido: SentidoMovimientoCuentaCorriente) => {
    if (nextSentido === sentido) return;
    const prevDefault = getDefaultMontoForSentido(entidad, sentido, saldoActual);
    const nextDefault = getDefaultMontoForSentido(entidad, nextSentido, saldoActual);
    const hasFav = Boolean(cuentaFavorita?.id);

    setSentido(nextSentido);
    setErrorMsg(null);
    idempotencyKeyRef.current = generateUuidV4();

    setPagosDraft((prev) => {
      if (prev.length === 1 && (prev[0].monto === prevDefault || prev[0].monto === "")) {
        setShowAdvanced(!hasFav || !nextDefault);
        return [{ ...prev[0], monto: nextDefault }];
      }
      if (!prev[0]?.monto) {
        setShowAdvanced(true);
      }
      return prev;
    });
  };

  const totalSumDraft = useMemo(
    () =>
      pagosDraft.reduce((acc, p) => {
        const val = Number(p.monto);
        return acc + (Number.isFinite(val) && val > 0 ? val : 0);
      }, 0),
    [pagosDraft]
  );

  const canSubmit = useMemo(() => {
    if (submitting || pagosDraft.length === 0) return false;
    for (const p of pagosDraft) {
      const val = Number(p.monto);
      if (!Number.isFinite(val) || val <= 0 || !isValidMonto(val)) return false;
      if (!p.cuentaId) return false;
      if (p.cuentaId === CREATE_CUENTA_VALUE) {
        if (!p.cuentaDraft || !validateCuentaFinancieraForm(p.cuentaDraft)) return false;
      }
      if (!isValidDate(p.fecha)) return false;
    }
    return totalSumDraft > 0;
  }, [pagosDraft, submitting, totalSumDraft]);

  const isProveedor = entidad === "PROVEEDOR";
  const isReductorDeuda = sentido === getDefaultSentido(entidad);
  const objetivoSaldo = isReductorDeuda
    ? saldoActual > 0
      ? saldoActual
      : 0
    : saldoActual < 0
    ? Math.abs(saldoActual)
    : 0;
  const nuevoSaldo = isReductorDeuda
    ? saldoActual - totalSumDraft
    : saldoActual + totalSumDraft;

  const handleAddPagoRow = () => {
    const restante = Math.max(0, objetivoSaldo - totalSumDraft);
    setPagosDraft((prev) => [
      ...prev,
      {
        id: generateUuidV4(),
        cuentaId: "",
        monto: restante > 0 ? String(restante) : "",
        fecha: toISODateAppTimeZone(),
        descripcion: "",
      },
    ]);
  };

  const handleRemovePagoRow = (id: string) => {
    if (pagosDraft.length <= 1) return;
    setPagosDraft((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePagoRow = (id: string, field: keyof PagoDraftItem, value: string) => {
    setPagosDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleUpdatePagoCuentaDraft = (id: string, patch: Partial<CuentaFinancieraDraft>) => {
    setPagosDraft((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              cuentaDraft: {
                ...(row.cuentaDraft || EMPTY_CUENTA_FINANCIERA_DRAFT),
                ...patch,
              },
            }
          : row
      )
    );
  };

  const handleRestoreFavorita = () => {
    if (!cuentaFavorita?.id) return;
    const defaultMonto = getDefaultMontoForSentido(entidad, sentido, saldoActual);
    const currentMonto = totalSumDraft > 0 ? String(totalSumDraft) : defaultMonto;
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: cuentaFavorita.id,
        monto: currentMonto,
        fecha: toISODateAppTimeZone(),
        descripcion: "",
      },
    ]);
    setShowAdvanced(!currentMonto);
  };

  const handleToggleAdvanced = () => {
    if (showAdvanced && cuentaFavorita && totalSumDraft > 0) {
      handleRestoreFavorita();
    } else {
      setShowAdvanced(true);
    }
  };

  const handleSaldarTotal = () => {
    if (objetivoSaldo <= 0) return;
    if (pagosDraft.length === 1) {
      handleUpdatePagoRow(pagosDraft[0].id, "monto", String(objetivoSaldo));
    } else {
      setPagosDraft([
        {
          id: generateUuidV4(),
          cuentaId: cuentaFavorita?.id ?? pagosDraft[0].cuentaId,
          monto: String(objetivoSaldo),
          fecha: toISODateAppTimeZone(),
          descripcion: "",
        },
      ]);
      if (cuentaFavorita?.id) setShowAdvanced(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const resolvedPagos = await Promise.all(
        pagosDraft.map(async (p) => {
          let finalCuentaId = p.cuentaId;
          if (p.cuentaId === CREATE_CUENTA_VALUE && p.cuentaDraft) {
            const created = await createCuenta({
              nombre: p.cuentaDraft.nombre.trim(),
              tipo: p.cuentaDraft.tipo,
              saldoInicial: 0,
            });
            finalCuentaId = created.id;
          }
          const fechaIso = toISODateTimeWithLocalCurrentTime(p.fecha) ?? new Date().toISOString();
          return {
            cuentaId: finalCuentaId,
            monto: Number(p.monto),
            fecha: fechaIso,
            descripcion: p.descripcion.trim() || undefined,
            idempotencyKey: generateUuidV4(),
          };
        })
      );

      const payload =
        resolvedPagos.length === 1
          ? {
              sentido,
              cuentaId: resolvedPagos[0].cuentaId,
              monto: resolvedPagos[0].monto,
              fecha: resolvedPagos[0].fecha,
              descripcion: resolvedPagos[0].descripcion,
              observaciones: observaciones.trim() || undefined,
              idempotencyKey: idempotencyKeyRef.current,
            }
          : {
              sentido,
              pagos: resolvedPagos,
              monto: totalSumDraft,
              observaciones: observaciones.trim() || undefined,
              idempotencyKey: idempotencyKeyRef.current,
            };

      const res = isProveedor
        ? await proveedoresClient.registrarPagoDirecto(contraparteId, payload)
        : await clientesClient.registrarMovimientoDirecto(contraparteId, payload);

      if (res.error || !res.data) {
        throw new Error(res.error || "Error al registrar el movimiento en cuenta corriente.");
      }

      if (typeof cuentasCtx.refresh === "function") {
        void cuentasCtx.refresh();
      }

      const isCobro = sentido === "COBRO";
      toast.success(
        isCobro ? "Cobro registrado" : "Pago registrado",
        isProveedor
          ? isCobro
            ? `Se registró el reintegro de ${formatArs(totalSumDraft)} de ${contraparteNombre}.`
            : `Se registró el pago de ${formatArs(totalSumDraft)} a ${contraparteNombre}.`
          : isCobro
          ? `Se registró el cobro de ${formatArs(totalSumDraft)} de ${contraparteNombre}.`
          : `Se registró el pago / devolución de ${formatArs(totalSumDraft)} a ${contraparteNombre}.`
      );
      onSuccess();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error inesperado al registrar movimiento."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = isProveedor
    ? sentido === "COBRO"
      ? "Registrar cobro / reintegro en cuenta corriente"
      : "Registrar pago a cuenta corriente"
    : sentido === "PAGO"
    ? "Registrar pago / devolución a cliente"
    : "Registrar cobro en cuenta corriente";

  const pillLabel = isProveedor
    ? sentido === "COBRO"
      ? `Recuperar saldo a favor (${formatArs(objetivoSaldo)})`
      : `Pagar total adeudado (${formatArs(objetivoSaldo)})`
    : sentido === "PAGO"
    ? `Devolver saldo a favor (${formatArs(objetivoSaldo)})`
    : `Cobrar total adeudado (${formatArs(objetivoSaldo)})`;

  const pagoBtn = (
    <button
      key="PAGO"
      type="button"
      onClick={() => handleSentidoChange("PAGO")}
      style={{
        ...styles.segmentedBtn,
        ...(sentido === "PAGO" ? styles.segmentedBtnActivePago : {}),
      }}
      aria-pressed={sentido === "PAGO"}
      data-testid="movimiento-cc-sentido-pago"
    >
      <ArrowUpRight size={15} />
      <span>{isProveedor ? "Pagar a proveedor" : "Pagar / Devolver"}</span>
    </button>
  );

  const cobroBtn = (
    <button
      key="COBRO"
      type="button"
      onClick={() => handleSentidoChange("COBRO")}
      style={{
        ...styles.segmentedBtn,
        ...(sentido === "COBRO" ? styles.segmentedBtnActiveCobro : {}),
      }}
      aria-pressed={sentido === "COBRO"}
      data-testid="movimiento-cc-sentido-cobro"
    >
      <ArrowDownLeft size={15} />
      <span>{isProveedor ? "Cobro / Reintegro" : "Cobrar a cliente"}</span>
    </button>
  );

  return (
    <Modal
      open={open}
      title={modalTitle}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      submitText={sentido === "COBRO" ? "Confirmar cobro" : "Confirmar pago"}
      submittingText="Registrando..."
      submitting={submitting}
      disabledSubmit={!canSubmit}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={styles.segmentedGroup} role="group" aria-label="Tipo de movimiento">
          {isProveedor ? [pagoBtn, cobroBtn] : [cobroBtn, pagoBtn]}
        </div>

        <div style={styles.saldoBanner}>
          <div>
            <div style={{ fontSize: 12, color: COLOR.TEXT.SECONDARY, fontWeight: 500 }}>
              {isProveedor ? "Proveedor" : "Cliente"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>
              {contraparteNombre}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: COLOR.TEXT.SECONDARY, fontWeight: 500 }}>
              Saldo actual en cuenta
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color:
                  saldoActual > 0
                    ? COLOR.STATUS.WARNING.TEXT
                    : saldoActual < 0
                    ? COLOR.STATUS.SUCCESS.TEXT
                    : COLOR.TEXT.PRIMARY,
              }}
            >
              {saldoActual > 0
                ? formatArs(saldoActual)
                : saldoActual < 0
                ? `A favor: ${formatArs(Math.abs(saldoActual))}`
                : "Al día ($0)"}
            </div>
          </div>
        </div>

        {objetivoSaldo > 0 && totalSumDraft !== objetivoSaldo && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              style={styles.pillBtn}
              onClick={handleSaldarTotal}
              data-testid="movimiento-cc-saldar-total-btn"
            >
              {pillLabel}
            </button>
          </div>
        )}

        {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

        <PagoCondicionSection
          tipo={sentido === "COBRO" ? "VENTA" : "COMPRA"}
          totalOperacion={totalSumDraft}
          cuentaFavorita={cuentaFavorita}
          contraparteNombre={contraparteNombre}
          pagos={pagosDraft}
          onAddPago={handleAddPagoRow}
          onRemovePago={handleRemovePagoRow}
          onUpdatePago={handleUpdatePagoRow}
          onUpdatePagoCuentaDraft={handleUpdatePagoCuentaDraft}
          onRestoreFavorita={handleRestoreFavorita}
          allowNoPagar={false}
          loadingCuentas={loadingCuentas}
          showAdvanced={showAdvanced}
          onToggleAdvanced={handleToggleAdvanced}
          dataTestIdSimple="movimiento-cc-simple"
          dataTestIdToggle="movimiento-cc-advanced-toggle"
        />

        <div>
          <label style={styles.label}>Observaciones adicionales (opcional)</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="ej. Nro de comprobante o nota interna"
            style={styles.input}
            data-testid="movimiento-cc-observaciones-input"
          />
        </div>

        {totalSumDraft > 0 && (
          <div style={styles.impactBox}>
            <div style={styles.impactRow}>
              <span>Saldo actual en cuenta:</span>
              <span style={{ fontWeight: 600 }}>{formatArs(saldoActual)}</span>
            </div>
            <div style={styles.impactRow}>
              <span>{sentido === "COBRO" ? "Total a cobrar / ingresar:" : "Total a abonar / egresar:"}</span>
              <span
                style={{
                  fontWeight: 600,
                  color: isReductorDeuda ? COLOR.STATUS.SUCCESS.TEXT : COLOR.STATUS.WARNING.TEXT,
                }}
              >
                {isReductorDeuda ? `- ${formatArs(totalSumDraft)}` : `+ ${formatArs(totalSumDraft)}`}
              </span>
            </div>
            <div
              style={{
                ...styles.impactRow,
                borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
                paddingTop: 6,
                marginTop: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>Nuevo saldo:</span>
              <span
                style={{
                  fontWeight: 700,
                  color:
                    nuevoSaldo > 0
                      ? COLOR.STATUS.WARNING.TEXT
                      : nuevoSaldo < 0
                      ? COLOR.STATUS.SUCCESS.TEXT
                      : COLOR.TEXT.PRIMARY,
                }}
              >
                {nuevoSaldo > 0
                  ? formatArs(nuevoSaldo)
                  : nuevoSaldo < 0
                  ? `A favor: ${formatArs(Math.abs(nuevoSaldo))}`
                  : "Al día ($0)"}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  segmentedGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
    padding: 4,
    borderRadius: 10,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  segmentedBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 7,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  segmentedBtnActivePago: {
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    borderColor: COLOR.BORDER.SUBTLE,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  },
  segmentedBtnActiveCobro: {
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.ACCENT.PRIMARY,
    borderColor: COLOR.BORDER.SUBTLE,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  },
  saldoBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  label: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: 14,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    background: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.PRIMARY,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  pillBtn: {
    background: "none",
    border: "none",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: "2px 6px",
  },
  impactBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    padding: "12px 14px",
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 8,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  impactRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorBox: {
    padding: "10px 14px",
    borderRadius: 8,
    background: "rgba(239, 68, 68, 0.1)",
    border: `1px solid ${COLOR.SEMANTIC.DANGER}`,
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 13,
    fontWeight: 500,
  },
};

