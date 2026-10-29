"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import { CheckCircle2 } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
import PagoSummaryBox from "@/app/components/finanzas/PagoSummaryBox";
import OperacionPagoHistorial from "@/app/components/operaciones/OperacionPagoHistorial";
import {
  type PagoDraftItem,
  CREATE_CUENTA_VALUE,
} from "@/app/components/arreglos/RegistrarPagoSection";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import type { Operacion } from "@/model/types";
import { formatArs } from "@/lib/format";
import { isValidDate, toISODateAppTimeZone, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import { COLOR } from "@/theme/theme";
import { logger } from "@/lib/logger";

export interface OperacionPagoModalProps {
  open: boolean;
  operacionId?: string | number;
  operacion?: Operacion | null;
  onClose: () => void;
  onSuccess?: (updated?: Operacion) => void;
  onPaid?: (updated?: Operacion) => void;
}

export default function OperacionPagoModal({
  open,
  operacionId: propOperacionId,
  operacion: propOperacion,
  onClose,
  onSuccess,
  onPaid,
}: OperacionPagoModalProps) {
  const { registrarPago, anularPago, fetchById } = useOperaciones();
  const { loading: loadingCuentas, cuentaFavorita, createCuenta } = useCuentasFinancieras();
  const { success, error } = useToast();
  const { confirm } = useModalMessage();
  const cuentaFavoritaId = cuentaFavorita?.id ?? null;
  const hasCuentaFavorita = cuentaFavoritaId !== null;

  const operacionId = String(propOperacionId ?? propOperacion?.id ?? "");
  const propOpRef = useRef(propOperacion);
  propOpRef.current = propOperacion;

  const [loadingData, setLoadingData] = useState(false);
  const [operacion, setOperacion] = useState<Operacion | null>(propOperacion ?? null);
  const [anulandoPagoId, setAnulandoPagoId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const [pagosDraft, setPagosDraft] = useState<PagoDraftItem[]>([
    {
      id: generateUuidV4(),
      cuentaId: "",
      monto: "",
      fecha: toISODateAppTimeZone(),
      descripcion: "",
    },
  ]);

  const initDraftForOp = useCallback(
    (op: Operacion) => {
      const total =
        op.monto_total ??
        (op as { monto?: number }).monto ??
        (op.lineas ?? []).reduce(
          (acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
          0
        );
      const pagado = op.total_pagado ?? (op.esta_pago ? total : 0);
      const saldo = op.saldo_pendiente ?? Math.max(0, total - pagado);

      setPagosDraft([
        {
          id: generateUuidV4(),
          cuentaId: cuentaFavoritaId ?? "",
          monto: saldo > 0 ? String(saldo) : "",
          fecha: toISODateAppTimeZone(),
          descripcion: "",
        },
      ]);
    },
    [cuentaFavoritaId]
  );

  const loadOperacionDetails = useCallback(async () => {
    if (!operacionId || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingData(true);
    try {
      const data = await fetchById(operacionId);
      const op = data ?? propOpRef.current ?? null;
      if (op) {
        setOperacion(op);
        initDraftForOp(op);
      }
    } catch (err: unknown) {
      logger.error("Error loading operacion for pago modal:", err);
    } finally {
      setLoadingData(false);
      inFlightRef.current = false;
    }
  }, [operacionId, fetchById, initDraftForOp]);

  useEffect(() => {
    if (open) {
      setShowAdvanced(!hasCuentaFavorita);
      const initialOp = propOpRef.current ?? null;
      if (initialOp) {
        setOperacion(initialOp);
        initDraftForOp(initialOp);
      }
      void loadOperacionDetails();
    } else {
      setOperacion(propOpRef.current ?? null);
    }
  }, [open, hasCuentaFavorita, loadOperacionDetails, initDraftForOp]);

  const currentOp = operacion ?? propOperacion ?? null;
  const totalMonto =
    currentOp?.monto_total ??
    (currentOp as { monto?: number })?.monto ??
    (currentOp?.lineas ?? []).reduce(
      (acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
      0
    );
  const totalPagado =
    currentOp?.total_pagado ?? (currentOp?.esta_pago ? totalMonto : 0);
  const saldoPendiente =
    currentOp?.saldo_pendiente ?? Math.max(0, totalMonto - totalPagado);
  const isVenta = (currentOp?.tipo ?? "VENTA") === "VENTA";
  const isReady = open && !loadingData && currentOp !== null;

  const totalSumDraft = useMemo(() => {
    return pagosDraft.reduce((acc, row) => acc + (Number(row.monto) || 0), 0);
  }, [pagosDraft]);

  const canSubmit = useMemo(() => {
    if (loadingCuentas || submitting) return false;
    if (pagosDraft.length === 0) return false;

    const allValid = pagosDraft.every((p) => {
      const isCreating = p.cuentaId === CREATE_CUENTA_VALUE;
      const hasValidCuenta = isCreating
        ? validateCuentaFinancieraForm(p.cuentaDraft)
        : Boolean(p.cuentaId);
      const montoNum = Number(p.monto);
      return (
        hasValidCuenta &&
        Number.isFinite(montoNum) &&
        montoNum > 0 &&
        isValidDate(p.fecha)
      );
    });

    if (!allValid) return false;
    if (saldoPendiente > 0 && totalSumDraft > saldoPendiente) return false;

    return true;
  }, [loadingCuentas, submitting, pagosDraft, saldoPendiente, totalSumDraft]);

  const handleAddPagoRow = () => {
    const restante = Math.max(0, saldoPendiente - totalSumDraft);
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

  const resetSimplePayment = useCallback(() => {
    if (!cuentaFavoritaId) return;
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: cuentaFavoritaId,
        monto: saldoPendiente > 0 ? String(saldoPendiente) : "",
        fecha: toISODateAppTimeZone(),
        descripcion: "",
      },
    ]);
  }, [cuentaFavoritaId, saldoPendiente]);

  const handleToggleAdvanced = () => {
    if (showAdvanced && cuentaFavorita) {
      resetSimplePayment();
    }
    setShowAdvanced((current) => !current);
  };

  const handleRestoreFavorita = () => {
    resetSimplePayment();
    setShowAdvanced(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !operacionId) return;

    setSubmitting(true);
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
          };
        })
      );

      let ok = false;
      if (resolvedPagos.length === 1) {
        ok = await registrarPago(operacionId, resolvedPagos[0]);
      } else {
        ok = await registrarPago(operacionId, {
          pagos: resolvedPagos,
        });
      }

      if (ok) {
        success(
          isVenta ? "Cobro registrado" : "Pago registrado",
          `Se registró exitosamente el ${isVenta ? "cobro" : "pago"} de ${formatArs(totalSumDraft)}.`
        );
        onPaid?.(currentOp ?? undefined);
        onSuccess?.(currentOp ?? undefined);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar el pago";
      error("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnularPago = async (pagoId: string, importe: number) => {
    const confirmed = await confirm({
      title: isVenta ? "Anular cobro" : "Anular pago",
      message: `¿Estás seguro de que querés anular este ${isVenta ? "cobro" : "pago"} de ${formatArs(importe)}? Se generará el reverso contable correspondiente.`,
      acceptLabel: isVenta ? "Anular cobro" : "Anular pago",
      cancelLabel: "Cancelar",
    });
    if (!confirmed || !operacionId) return;

    setAnulandoPagoId(pagoId);
    try {
      const updated = await anularPago(operacionId, pagoId);
      if (updated) {
        success(
          isVenta ? "Cobro anulado" : "Pago anulado",
          `El ${isVenta ? "cobro" : "pago"} fue anulado y el saldo fue actualizado.`
        );
        setOperacion(updated);
        initDraftForOp(updated);
        onPaid?.(updated);
        onSuccess?.(updated);
        await loadOperacionDetails();
      }
    } catch (err: unknown) {
      error("Error", err instanceof Error ? err.message : `No se pudo anular el ${isVenta ? "cobro" : "pago"}`);
    } finally {
      setAnulandoPagoId(null);
    }
  };

  return (
    <Modal
      open={open}
      title={isVenta ? "Gestión de cobros" : "Gestión de pagos"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={
        totalSumDraft > 0
          ? `${isVenta ? "Cobrar" : "Pagar"} ${formatArs(totalSumDraft)}`
          : isVenta
          ? "Confirmar Cobro"
          : "Confirmar Pago"
      }
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(640px, 96vw)" }}
    >
      <div css={styles.container}>
        <PagoSummaryBox
          tipo={isVenta ? "VENTA" : (currentOp?.tipo === "GASTO" ? "GASTO" : "COMPRA")}
          total={totalMonto}
          totalPagado={totalPagado}
          saldoPendiente={saldoPendiente}
          isReady={isReady}
        />

        {saldoPendiente <= 0 && totalMonto > 0 ? (
          <div css={styles.alertSuccess} data-testid="operacion-pago-success-alert">
            <CheckCircle2 size={18} color={COLOR.SEMANTIC.SUCCESS} />
            <span>
              {currentOp?.tipo === "GASTO"
                ? "El gasto se encuentra totalmente pagado."
                : `La ${isVenta ? "venta" : "compra"} se encuentra totalmente ${isVenta ? "cobrada" : "pagada"}.`}{" "}
              Podés registrar {isVenta ? "cobros" : "pagos"} adicionales o anular pagos registrados previamente.
            </span>
          </div>
        ) : null}

        <PagoCondicionSection
          tipo={isVenta ? "VENTA" : (currentOp?.tipo === "GASTO" ? "GASTO" : "COMPRA")}
          totalOperacion={totalSumDraft}
          cuentaFavorita={cuentaFavorita}
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
          dataTestIdSimple="operacion-pago-simple"
          dataTestIdToggle="operacion-pago-advanced-toggle"
        />

        <OperacionPagoHistorial
          pagos={currentOp?.pagos}
          tipo={currentOp?.tipo}
          anulandoPagoId={anulandoPagoId}
          onAnularPago={handleAnularPago}
        />
      </div>
    </Modal>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "8px 0",
  }),
  alertSuccess: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: COLOR.STATUS.SUCCESS.BG_SUBTLE,
    border: `1px solid ${COLOR.STATUS.SUCCESS.BORDER}`,
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.4,
  }),
};
