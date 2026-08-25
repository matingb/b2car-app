"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import { CheckCircle2, ChevronDown, WalletCards } from "lucide-react";
import RegistrarPagoSection, {
  type PagoDraftItem,
  CREATE_CUENTA_VALUE,
} from "@/app/components/arreglos/RegistrarPagoSection";
import CobroArregloHistorial from "@/app/components/arreglos/CobroArregloHistorial";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import Modal from "@/app/components/ui/Modal";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import type { Arreglo, CobroArregloItem } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { isValidDate, toISODateLocal } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

type Props = {
  open: boolean;
  arregloId: string | number;
  onClose: () => void;
  onPaid?: (arreglo: Arreglo) => void;
};

function useAnimatedCounter(target: number, isReady: boolean, duration = 450) {
  const [current, setCurrent] = useState<number | null>(null);
  const prevRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isReady) {
      setCurrent(null);
      prevRef.current = 0;
      return;
    }

    const from = prevRef.current;
    const to = target;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = from + (to - from) * ease;
      setCurrent(val);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, isReady, duration]);

  return isReady && current !== null ? Math.round(current) : null;
}

export default function CobroArregloModal({ open, arregloId, onClose, onPaid }: Props) {
  const { cobrar, anularCobro, fetchById } = useArreglos();
  const { success, error } = useToast();
  const { confirm } = useModalMessage();
  const { loading: loadingCuentas, createCuenta, cuentaFavorita } = useCuentasFinancieras();
  const cuentaFavoritaId = cuentaFavorita?.id ?? null;
  const hasCuentaFavorita = cuentaFavoritaId !== null;

  const [loadingData, setLoadingData] = useState(false);
  const [arreglo, setArreglo] = useState<Arreglo | null>(null);
  const [cobros, setCobros] = useState<CobroArregloItem[]>([]);

  const [pagosDraft, setPagosDraft] = useState<PagoDraftItem[]>([
    {
      id: generateUuidV4(),
      cuentaId: "",
      monto: "",
      fecha: toISODateLocal(new Date()),
      descripcion: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [anulandoOpId, setAnulandoOpId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inFlightRef = useRef(false);

  const loadArregloDetails = useCallback(async () => {
    if (!arregloId || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingData(true);
    try {
      const data = await fetchById(arregloId);
      if (data?.arreglo) {
        setArreglo(data.arreglo);
        setCobros(data.cobros ?? []);

        const saldo = Math.max(
          0,
          Number(data.arreglo.precio_final || 0) - Number(data.arreglo.total_cobrado || 0)
        );

        setPagosDraft([
          {
            id: generateUuidV4(),
            cuentaId: cuentaFavoritaId ?? "",
            monto: saldo > 0 ? String(saldo) : "",
            fecha: toISODateLocal(new Date()),
            descripcion: "",
          },
        ]);
      }
    } catch (err) {
      console.error("Error loading arreglo for cobro modal:", err);
    } finally {
      setLoadingData(false);
      inFlightRef.current = false;
    }
  }, [arregloId, cuentaFavoritaId, fetchById]);

  useEffect(() => {
    if (open) {
      setShowAdvanced(!hasCuentaFavorita);
      void loadArregloDetails();
    } else {
      setArreglo(null);
    }
  }, [open, hasCuentaFavorita, loadArregloDetails]);

  const precioFinal = Number(arreglo?.precio_final || 0);
  const totalCobrado = Number(arreglo?.total_cobrado || 0);
  const saldoPendiente = Math.max(0, precioFinal - totalCobrado);

  const isReady = open && !loadingData && arreglo !== null;
  const animatedPrecioFinal = useAnimatedCounter(precioFinal, isReady, 450);
  const animatedTotalCobrado = useAnimatedCounter(totalCobrado, isReady, 450);
  const animatedSaldoPendiente = useAnimatedCounter(saldoPendiente, isReady, 450);

  const totalSumDraft = useMemo(() => {
    return pagosDraft.reduce((acc, row) => acc + (Number(row.monto) || 0), 0);
  }, [pagosDraft]);

  const canSubmit = useMemo(() => {
    if (loadingCuentas || submitting) return false;
    if (pagosDraft.length === 0) return false;

    return pagosDraft.every((p) => {
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
  }, [loadingCuentas, submitting, pagosDraft]);

  const handleAddPagoRow = () => {
    const restante = Math.max(0, saldoPendiente - totalSumDraft);
    setPagosDraft((prev) => [
      ...prev,
      {
        id: generateUuidV4(),
        cuentaId: "",
        monto: restante > 0 ? String(restante) : "",
        fecha: toISODateLocal(new Date()),
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
        fecha: toISODateLocal(new Date()),
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const resolvedPagos = await Promise.all(
        pagosDraft.map(async (p) => {
          let cuentaId = p.cuentaId;
          if (p.cuentaId === CREATE_CUENTA_VALUE && p.cuentaDraft) {
            const created = await createCuenta({
              nombre: p.cuentaDraft.nombre.trim(),
              tipo: p.cuentaDraft.tipo,
              saldoInicial: 0,
            });
            cuentaId = created.id;
          }
          return {
            cuentaId,
            monto: Number(p.monto),
            fecha: p.fecha,
            descripcion: p.descripcion.trim() || undefined,
          };
        })
      );

      let updated: Arreglo | null = null;

      if (resolvedPagos.length === 1) {
        const single = resolvedPagos[0];
        updated = await cobrar(arregloId, {
          cuenta_financiera_id: single.cuentaId,
          fecha_cobro: single.fecha,
          monto: single.monto,
          descripcion: single.descripcion,
          idempotency_key: generateUuidV4(),
        });
      } else {
        const pagosPayload = resolvedPagos.map((p) => ({
          cuenta_financiera_id: p.cuentaId,
          monto: p.monto,
          descripcion: p.descripcion,
        }));

        updated = await cobrar(arregloId, {
          fecha_cobro: resolvedPagos[0].fecha,
          pagos: pagosPayload,
          idempotency_key: generateUuidV4(),
        });
      }

      if (!updated) throw new Error("No se pudo registrar el cobro");
      success("Cobro registrado", `Se registraron ${formatArs(totalSumDraft)} en las cuentas seleccionadas.`);
      onPaid?.(updated);
      onClose();
    } catch (cause: unknown) {
      error("No se pudo registrar el cobro", cause instanceof Error ? cause.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnularCobro = async (opId: string, importe: number) => {
    const confirmed = await confirm({
      title: "Anular cobro",
      message: `¿Estás seguro de que querés anular este cobro de ${formatArs(importe)}? Se generará el reverso contable correspondiente.`,
      acceptLabel: "Anular cobro",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;

    setAnulandoOpId(opId);
    try {
      const updated = await anularCobro(arregloId, opId);
      if (updated) {
        success("Cobro anulado", "El cobro fue anulado y el saldo del arreglo fue actualizado.");
        onPaid?.(updated);
        await loadArregloDetails();
      }
    } catch (err) {
      error("Error", err instanceof Error ? err.message : "No se pudo anular el cobro");
    } finally {
      setAnulandoOpId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Gestión de cobros"
      submitText={
        totalSumDraft > 0
          ? `Cobrar ${formatArs(totalSumDraft)}`
          : "Registrar Cobro"
      }
      submitting={submitting}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(640px, 96vw)" }}
    >
      <div css={styles.form}>
        <div css={styles.summaryBox}>
          <div css={styles.summaryItem}>
            <span css={styles.summaryLabel}>Total Arreglo</span>
            <span css={styles.summaryValue} data-testid="summary-total">
              {animatedPrecioFinal !== null
                ? formatArs(animatedPrecioFinal, { maxDecimals: 0 })
                : "-"}
            </span>
          </div>
          <div css={styles.summaryItem}>
            <span css={styles.summaryLabel}>Cobrado</span>
            <span css={styles.summaryValueSuccess} data-testid="summary-cobrado">
              {animatedTotalCobrado !== null
                ? formatArs(animatedTotalCobrado, { maxDecimals: 0 })
                : "-"}
            </span>
          </div>
          <div css={styles.summaryItem}>
            <span css={styles.summaryLabel}>Saldo Pendiente</span>
            <span
              css={
                animatedSaldoPendiente !== null && animatedSaldoPendiente > 0
                  ? styles.summaryValueDanger
                  : styles.summaryValueSuccess
              }
              data-testid="summary-saldo"
            >
              {animatedSaldoPendiente !== null
                ? formatArs(animatedSaldoPendiente, { maxDecimals: 0 })
                : "-"}
            </span>
          </div>
        </div>

        {saldoPendiente <= 0 && precioFinal > 0 ? (
          <div css={styles.alertSuccess}>
            <CheckCircle2 size={18} color={COLOR.SEMANTIC.SUCCESS} />
            <span>El arreglo se encuentra <strong>totalmente pagado</strong>. Podés registrar cobros adicionales o anular cobros existentes.</span>
          </div>
        ) : null}

        {cuentaFavorita && !showAdvanced ? (
          <div css={styles.simplePayment} data-testid="cobro-simple">
            <div css={styles.simpleAccountIcon}>
              <WalletCards size={20} />
            </div>
            <div css={styles.simpleAccountText}>
              <span css={styles.simpleAccountLabel}>El cobro se acreditara en la cuenta favorita</span>
              <strong css={styles.simpleAccountName}>{cuentaFavorita.nombre}</strong>
              <span css={styles.simpleAccountAmount}>
                Importe: {formatArs(totalSumDraft, { maxDecimals: 0 })}
              </span>
            </div>
          </div>
        ) : (
          <RegistrarPagoSection
            pagos={pagosDraft}
            loadingCuentas={loadingCuentas}
            onAddPago={handleAddPagoRow}
            onRemovePago={handleRemovePagoRow}
            onUpdatePago={handleUpdatePagoRow}
            onUpdatePagoCuentaDraft={handleUpdatePagoCuentaDraft}
          />
        )}

        {cuentaFavorita ? (
          <button
            type="button"
            css={styles.advancedToggle}
            onClick={handleToggleAdvanced}
            aria-expanded={showAdvanced}
            data-testid="cobro-advanced-toggle"
          >
            <span>{showAdvanced ? "Usar cobro simplificado" : "Elegir otra cuenta o dividir el pago"}</span>
            <ChevronDown size={17} css={showAdvanced ? styles.chevronOpen : undefined} />
          </button>
        ) : null}

        <CobroArregloHistorial
          cobros={cobros}
          anulandoOpId={anulandoOpId}
          onAnularCobro={handleAnularCobro}
        />
      </div>
    </Modal>
  );
}

const styles = {
  form: css({
    display: "flex",
    flexDirection: "column",
    gap: 16,
    paddingTop: 4,
  }),
  summaryBox: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
  }),
  summaryItem: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  summaryLabel: css({
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 600,
    color: COLOR.TEXT.TERTIARY,
  }),
  summaryValue: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  }),
  summaryValueSuccess: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  summaryValueDanger: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.SEMANTIC.DANGER,
  }),
  alertSuccess: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: "rgba(22, 163, 74, 0.08)",
    border: "1px solid rgba(22, 163, 74, 0.25)",
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    lineHeight: 1.4,
  }),
  simplePayment: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
  }),
  simpleAccountIcon: css({
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: 10,
    color: COLOR.ACCENT.PRIMARY,
    backgroundColor: COLOR.BACKGROUND.INFO_TINT,
  }),
  simpleAccountText: css({
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  simpleAccountLabel: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  simpleAccountName: css({
    color: COLOR.TEXT.PRIMARY,
    fontSize: 16,
  }),
  simpleAccountAmount: css({
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  }),
  advancedToggle: css({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "9px 11px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  }),
  chevronOpen: css({
    transform: "rotate(180deg)",
  }),
} as const;
