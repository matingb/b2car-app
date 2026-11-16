"use client";

import React from "react";
import { css } from "@emotion/react";
import { LayoutList, Table as TableIcon } from "lucide-react";
import { COLOR } from "@/theme/theme";

export type ViewMode = "table" | "cards";

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  style?: React.CSSProperties;
};

export default function ViewModeToggle({ value, onChange, style }: Props) {
  return (
    <div
      style={style}
      css={styles.toggleGroup}
      role="group"
      aria-label="Modo de visualización"
    >
      <button
        type="button"
        onClick={() => onChange("table")}
        css={[styles.toggleButton, value === "table" && styles.toggleButtonActive]}
        aria-pressed={value === "table"}
        data-testid="view-toggle-table"
        title="Vista de tabla"
      >
        <TableIcon size={15} />
        <span>Tabla</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        css={[styles.toggleButton, value === "cards" && styles.toggleButtonActive]}
        aria-pressed={value === "cards"}
        data-testid="view-toggle-cards"
        title="Vista de tarjetas"
      >
        <LayoutList size={15} />
        <span>Tarjetas</span>
      </button>
    </div>
  );
}

const styles = {
  toggleGroup: css({
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    padding: 3,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    gap: 2,
  }),
  toggleButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  toggleButtonActive: css({
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
  }),
};
