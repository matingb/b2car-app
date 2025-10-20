"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  title?: string;
  message?: React.ReactNode;
  oneButton?: boolean; // si true, solo se muestra el botón de aceptar
  acceptLabel?: string;
  cancelLabel?: string;
  onAccept?: () => void;
  onCancel?: () => void;
  // estilos opcionales
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
};

export default function ModalMessage({
  open,
  title = "",
  message,
  oneButton = false,
  acceptLabel = oneButton ? "Aceptar" : "Aceptar",
  cancelLabel = "Cancelar",
  onAccept,
  onCancel,
  style,
  contentStyle,
}: Props) {
  if (!open) return null;

  return (
    <div style={{ ...styles.overlay, ...(style ?? {}) }} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            {title ? <h2 style={styles.title}>{title}</h2> : null}
          </div>
          <div style={{ padding: "4px 0 12px", ...(contentStyle ?? {}) }}>
            {typeof message === "string" ? (
              <p style={{ margin: 0 }}>{message}</p>
            ) : (
              message
            )}
          </div>

          <div style={styles.footer}>
            {!oneButton && (
              <button
                type="button"
                style={styles.cancel}
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
            )}
            <Button text={acceptLabel} onClick={onAccept} />
          </div>
        </Card>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    width: "min(520px, 92vw)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    margin: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  cancel: {
    background: "transparent",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.PRIMARY,
    padding: "0.5rem 1rem",
    borderRadius: 8,
    cursor: "pointer",
  },
} as const;
