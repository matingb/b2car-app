"use client";

import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
  autoFocus,
  ariaLabel = "barra de búsqueda",
  style,
  className,
}: SearchBarProps) {
  return (
    <div style={styles.container} className={className}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        style={{ ...styles.input, ...(style ?? {}) }}
      />
    </div>
  );
}

const styles = {
  container: {
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    fontSize: "1rem",
    lineHeight: "1.5",
    outline: "none",
    transition: "box-shadow 150ms ease, border-color 150ms ease",
    boxSizing: "border-box" as const,
  },
} as const;


