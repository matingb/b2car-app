"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
import PagoSummaryBox from "@/app/components/finanzas/PagoSummaryBox";
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
import type { Operacion } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { isValidDate, toISODateAppTimeZone, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

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
  const { loading: loadingCuentas, cuentaFavorita, createCuenta } = useCuentasFinancieras();
  const { success, error } = useToast();

  const cuentaFavoritaId = cuentaFavorita?.id ?? null;
  const hasCuentaFavorita = cuentaFavoritaId !== null;

  const saldoPendiente = operacion?.saldo_pendiente ?? 0;
  const isVenta = operacion?.tipo === "VENTA";

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !operacion) return;
    setShowAdvanced(!hasCuentaFavorita);
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: cuentaFavoritaId ?? "",
        monto: saldoPendiente > 0 ? String(saldoPendiente) : "",
        fecha: toISODateAppTimeZone(),
        descripcion: "",
      },
    ]);
  }, [open, operacion?.id, saldoPendiente, cuentaFavoritaId, hasCuentaFavorita]);

  const totalSumDraft = useMemo(() => {
    return pagosDraft.reduce((acc, row) => acc + (Number(row.monto) || 0), 0);
  }, [pagosDraft]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !operacion) return;

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
        ok = await registrarPago(operacion.id, resolvedPagos[0]);
      } else {
        ok = await registrarPago(operacion.id, {
          pagos: resolvedPagos,
        });
      }

      if (ok) {
        success(
          isVenta ? "Cobro registrado" : "Pago registrado",
          `Se registró exitosamente el ${isVenta ? "cobro" : "pago"} de ${formatArs(totalSumDraft)}.`
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
      <div style={styles.container}>
        <PagoSummaryBox
          tipo={isVenta ? "VENTA" : "COMPRA"}
          total={operacion.monto_total ?? 0}
          totalPagado={operacion.total_pagado ?? 0}
          saldoPendiente={saldoPendiente}
          isReady={true}
        />

        <PagoCondicionSection
          tipo={isVenta ? "VENTA" : "COMPRA"}
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
};

