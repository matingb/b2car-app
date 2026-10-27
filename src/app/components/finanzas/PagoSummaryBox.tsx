"use client";

import React, { useEffect, useRef, useState } from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";

export interface PagoSummaryBoxProps {
  total: number;
  totalPagado: number;
  saldoPendiente: number;
  tipo?: "VENTA" | "COMPRA" | "ARREGLO";
  isReady?: boolean;
}

function useAnimatedCounter(target: number, isReady: boolean) {
  const [current, setCurrent] = useState<number | null>(null);
  const prevRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isReady) {
      setCurrent(null);
      prevRef.current = 0;
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      setCurrent(target);
      prevRef.current = target;
      return;
    }

    const from = prevRef.current;
    const to = target;
    const start = performance.now();
    const duration = 450;

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
  }, [target, isReady]);

  return isReady && current !== null
    ? Math.round(current)
    : isReady
    ? target
    : null;
}

export default function PagoSummaryBox({
  total,
  totalPagado,
  saldoPendiente,
  tipo = "ARREGLO",
  isReady = true,
}: PagoSummaryBoxProps) {
  const animatedTotal = useAnimatedCounter(total, isReady);
  const animatedPagado = useAnimatedCounter(totalPagado, isReady);
  const animatedSaldo = useAnimatedCounter(saldoPendiente, isReady);

  const totalLabel = tipo === "ARREGLO" ? "Total Arreglo" : "Total Acordado";
  const pagadoLabel = tipo === "COMPRA" ? "Pagado" : "Cobrado";

  return (
    <div css={styles.summaryBox}>
      <div css={styles.summaryItem}>
        <span css={styles.summaryLabel}>{totalLabel}</span>
        <span css={styles.summaryValue} data-testid="summary-total">
          {animatedTotal !== null
            ? formatArs(animatedTotal, { maxDecimals: 0 })
            : "-"}
        </span>
      </div>
      <div css={styles.summaryItem}>
        <span css={styles.summaryLabel}>{pagadoLabel}</span>
        <span css={styles.summaryValueSuccess} data-testid="summary-cobrado">
          {animatedPagado !== null
            ? formatArs(animatedPagado, { maxDecimals: 0 })
            : "-"}
        </span>
      </div>
      <div css={styles.summaryItem}>
        <span css={styles.summaryLabel}>Saldo Pendiente</span>
        <span
          css={
            animatedSaldo !== null && animatedSaldo > 0
              ? styles.summaryValueDanger
              : styles.summaryValueSuccess
          }
          data-testid="summary-saldo"
        >
          {animatedSaldo !== null
            ? formatArs(animatedSaldo, { maxDecimals: 0 })
            : "-"}
        </span>
      </div>
    </div>
  );
}

const styles = {
  summaryBox: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gridTemplateColumns: "1fr",
      gap: 8,
    },
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
};
