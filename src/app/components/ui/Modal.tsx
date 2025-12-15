"use client";

import React, { useId } from "react";
import Card from "./Card";
import Button from "./Button";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  submitText: string;
  submitting?: boolean;
  disabledSubmit?: boolean;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitText,
  submitting = false,
  disabledSubmit = false,
}: Props) {
  const titleId = useId();

  if (!open) return null;

  const isSubmitDisabled = disabledSubmit || submitting;

  return (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="modal-overlay"
    >
      <div style={styles.modal}>
        <Card>
          <div style={styles.headerRow}>
            <h2 id={titleId} style={styles.title} data-testid="modal-title">
              {title}
            </h2>
          </div>

          <form onSubmit={onSubmit}>
            {children}

            <div style={styles.footer}>
              <button
                type="button"
                style={styles.cancel}
                onClick={onClose}
                disabled={submitting}
                data-testid="modal-cancel"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                text={submitting ? "Guardando..." : submitText}
                disabled={isSubmitDisabled}
                data-testid="modal-submit"
              />
            </div>
          </form>
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
    width: "min(640px, 92vw)",
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


