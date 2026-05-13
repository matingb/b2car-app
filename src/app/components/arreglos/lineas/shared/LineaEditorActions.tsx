"use client";

import React from "react";
import { css, keyframes } from "@emotion/react";
import { Check, Loader2, X } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { styles as lineaStyles } from "./lineaStyles";
import { useInlineEditorContext } from "./InlineEditorContext";

type Props = {
  variant: "inline" | "footer";
};

const KIND_NOUN = {
  servicios: "servicio",
  repuestos: "repuesto",
} as const;

export default function LineaEditorActions({ variant }: Props) {
  const { kind, mode, validation, interactionEnabled, submitting, onConfirm, onCancel } =
    useInlineEditorContext();

  const confirmEnabled = interactionEnabled && validation.ok && !submitting;
  const cancelEnabled = interactionEnabled && !submitting;

  const confirmTitle =
    !validation.ok && validation.message
      ? validation.message
      : mode === "add"
        ? "Agregar"
        : "Guardar";
  const confirmAriaLabel =
    mode === "add" ? `agregar ${KIND_NOUN[kind]}` : "guardar cambios";
  const cancelAriaLabel =
    mode === "add" ? `cancelar agregar ${KIND_NOUN[kind]}` : "descartar cambios";

  return (
    <div css={variant === "inline" ? [styles.actions, styles.inlineActions] : [styles.actions, styles.footerActions]}>
      <button
        type="button"
        css={styles.confirmBtn}
        style={styles.actionState(confirmEnabled)}
        aria-label={confirmAriaLabel}
        onClick={() => void onConfirm()}
        disabled={!confirmEnabled}
        title={confirmTitle}
      >
        {submitting ? (
          <Loader2 size={18} color={COLOR.SEMANTIC.SUCCESS} css={styles.spin} />
        ) : (
          <Check size={18} color={COLOR.SEMANTIC.SUCCESS} />
        )}
      </button>
      <button
        type="button"
        css={styles.cancelBtn}
        style={styles.actionState(cancelEnabled)}
        aria-label={cancelAriaLabel}
        onClick={onCancel}
        disabled={!cancelEnabled}
        title="Cancelar"
      >
        <X size={18} color={COLOR.ICON.DANGER} />
      </button>
    </div>
  );
}

const spinKeyframes = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const styles = {
  actions: css({
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  }),
  inlineActions: css({
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
      flexBasis: "100%",
    },
  }),
  footerActions: css({
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      width: "auto",
      flexBasis: "auto",
    },
  }),
  confirmBtn: css({
    ...lineaStyles.confirmBtn,
  }),
  cancelBtn: css({
    ...lineaStyles.cancelBtn,
  }),
  spin: css({
    animation: `${spinKeyframes} 0.8s linear infinite`,
  }),
  actionState: (enabled: boolean): React.CSSProperties => ({
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  }),
} as const;
