"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";

export type ObservacionesCollapsibleProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  dataTestId?: string;
  toggleDataTestId?: string;
  style?: React.CSSProperties;
  defaultOpen?: boolean;
};

export default function ObservacionesCollapsible({
  value,
  onChange,
  label = "Observaciones adicionales",
  placeholder = "Observaciones adicionales sobre la operación...",
  rows = 2,
  dataTestId = "operaciones-stock-observaciones",
  toggleDataTestId = "operaciones-observaciones-toggle",
  style,
  defaultOpen = false,
}: ObservacionesCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isExpanded = isOpen || Boolean(value);

  return (
    <div style={{ ...style }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        css={styles.toggle}
        data-testid={toggleDataTestId}
      >
        <span>{label}</span>
        <ChevronDown
          size={15}
          style={{
            transform: isExpanded ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {(isExpanded || process.env.NODE_ENV === "test") && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            data-testid={dataTestId}
            style={styles.textarea}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  toggle: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    padding: "6px 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  textarea: {
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    resize: "vertical" as const,
    lineHeight: "1.5",
    width: "100%",
  } as const,
};
