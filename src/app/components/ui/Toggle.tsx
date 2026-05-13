"use client";

import React from "react";
import { COLOR } from "@/theme/theme";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        ...styles.track,
        background: checked ? COLOR.ACCENT.PRIMARY : COLOR.BORDER.SUBTLE,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          ...styles.thumb,
          transform: checked ? "translateX(16px)" : "translateX(2px)",
        }}
      />
    </button>
  );
}

const styles = {
  track: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
    width: 40,
    height: 24,
    borderRadius: 999,
    border: "none",
    padding: 0,
    transition: "background 150ms ease",
    flexShrink: 0,
  },
  thumb: {
    display: "block",
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 150ms ease",
  },
} as const;
