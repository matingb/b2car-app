"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import { COLOR } from "@/theme/theme";

type Props = {
  onClose?: () => void;
};

export default function NewProductBadge({ onClose }: Props) {
  return (
    <div style={styles.badge}>
      <Plus size={12} />
      Nuevo producto
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver al listado"
          title="Volver al listado"
          style={styles.closeBtn}
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

const styles = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    background: COLOR.BACKGROUND.SUCCESS_TINT,
    color: COLOR.SEMANTIC.SUCCESS,
    borderRadius: 999,
    padding: "4px 4px 4px 10px",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  } as const,
  closeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    border: "none",
    background: "transparent",
    color: COLOR.SEMANTIC.SUCCESS,
    cursor: "pointer",
    borderRadius: 999,
    padding: 0,
  } as const,
} as const;
