"use client";

import React from "react";
import { css } from "@emotion/react";
import { Check, Package, Wrench, X } from "lucide-react";
import { formatArs } from "@/lib/format";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { itemIconCircleStyle, styles as lineaStyles } from "./lineaStyles";

type Kind = "servicios" | "repuestos";
type Mode = "add" | "edit";

type Validation = { ok: true } | { ok: false; message?: string | null };

type Props = {
  kind: Kind;
  mode: Mode;
  top: React.ReactNode;
  qtyValue: string;
  unitValue: string;
  onQtyChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  interactionEnabled: boolean;
  validation: Validation;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  extra?: React.ReactNode;
};

export default function EditableLineaCard({
  kind,
  mode,
  top,
  qtyValue,
  unitValue,
  onQtyChange,
  onUnitChange,
  interactionEnabled,
  validation,
  onConfirm,
  onCancel,
  extra,
}: Props) {
  const qty = safeInt(qtyValue);
  const unit = safeMoney(unitValue);
  const totalValue = qty * unit;
  const totalText = formatMoney(totalValue);

  const confirmEnabled = interactionEnabled && validation.ok;
  const cancelEnabled = interactionEnabled;

  const confirmTitle =
    !validation.ok && validation.message ? validation.message : mode === "add" ? "Agregar" : "Guardar";
  const confirmAriaLabel = (() => {
    if (mode === "add") return kind === "servicios" ? "agregar servicio" : "agregar repuesto";
    return "guardar cambios";
  })();

  const cancelTitle = "Cancelar";
  const cancelAriaLabel = (() => {
    if (mode === "add") return kind === "servicios" ? "cancelar agregar servicio" : "cancelar agregar repuesto";
    return "descartar cambios";
  })();

  return (
    <div css={styles.card}>
      <div style={itemIconCircleStyle(kind)}>
        {kind === "servicios" ? (
          <Wrench size={18} color={COLOR.ACCENT.PRIMARY} />
        ) : (
          <Package size={18} color={COLOR.SEMANTIC.SUCCESS} />
        )}
      </div>

      <div css={styles.body}>
        <div css={styles.topWrap}>{top}</div>

        <div css={styles.qtyUnitRow}>
          <input
            css={styles.qtyInput}
            inputMode="numeric"
            pattern="[0-9]*"
            value={qtyValue}
            onChange={(e) => onQtyChange(e.target.value.replace(/\D/g, ""))}
            placeholder="1"
            disabled={!interactionEnabled}
            aria-label="Cantidad"
          />
          <input
            css={styles.unitInput}
            inputMode="numeric"
            pattern="[0-9]*"
            value={unitValue}
            onChange={(e) => onUnitChange(e.target.value.replace(/\D/g, ""))}
            placeholder="$73.000"
            disabled={!interactionEnabled}
            aria-label={kind === "servicios" ? "Valor unitario" : "Precio unitario"}
          />
        </div>

        <div css={styles.footer}>
          <div style={styles.totalText}>{totalText}</div>
          <div css={styles.actions}>
            <button
              type="button"
              style={styles.confirmBtn(confirmEnabled)}
              aria-label={confirmAriaLabel}
              onClick={() => void onConfirm()}
              disabled={!confirmEnabled}
              title={confirmTitle}
            >
              <Check size={18} color={COLOR.SEMANTIC.SUCCESS} />
            </button>
            <button
              type="button"
              style={styles.cancelBtn(cancelEnabled)}
              aria-label={cancelAriaLabel}
              onClick={onCancel}
              disabled={!cancelEnabled}
              title={cancelTitle}
            >
              <X size={18} color={COLOR.ICON.DANGER} />
            </button>
          </div>
        </div>
      </div>

      {extra ? <div>{extra}</div> : null}
    </div>
  );
}

function safeInt(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return formatArs(n, { maxDecimals: 0, minDecimals: 0 });
}

const styles = {
  card: css({
    ...lineaStyles.itemCard,
    gap: 10,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flexWrap: "nowrap",
    },
  }),
  body: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
  }),
  topWrap: css({
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      flex: 1,
    },
  }),
  qtyUnitRow: css({
    display: "flex",
    gap: 10,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      width: "auto",
      flexWrap: "nowrap",
    },
  }),
  qtyInput: css({
    ...lineaStyles.editorInput,
    ...lineaStyles.editorInputRight,
    width: 70,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "30%",
    },
  }),
  unitInput: css({
    ...lineaStyles.editorInput,
    ...lineaStyles.editorInputRight,
    width: 130,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "70%",
    },
  }),
  footer: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    [`@media (min-width: ${BREAKPOINTS.lg}px)`]: {
      width: "auto",
      flexShrink: 0,
    },
  }),
  actions: css({
    display: "flex",
    gap: 8,
    flexShrink: 0,
  }),
  confirmBtn: (enabled: boolean): React.CSSProperties => ({
    ...lineaStyles.confirmBtn,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  }),
  cancelBtn: (enabled: boolean): React.CSSProperties => ({
    ...lineaStyles.cancelBtn,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  }),
  totalText: {
    fontWeight: 700,
    fontSize: 16,
    whiteSpace: "nowrap",
    minWidth: 70,
  },
} as const;

