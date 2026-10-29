"use client";

import { COLOR } from "@/theme/theme";
import React from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  inputTestId?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
  autoFocus,
  ariaLabel = "barra de búsqueda",
  style,
  className,
  inputTestId,
}: SearchBarProps) {
  return (
    <div style={{ ...styles.container, ...(style ?? {}) }} className={className}>
      <Search
        size={18}
        color={COLOR.TEXT.SECONDARY}
        style={styles.icon}
        aria-hidden="true"
        data-testid="search-bar-icon"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={inputTestId}
        autoFocus={autoFocus}
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: 40,
    position: "relative" as const,
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  icon: {
    position: "absolute" as const,
    left: "0.75rem",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none" as const,
    flexShrink: 0,
  },
  input: {
    height: "100%",
    width: "100%",
    padding: "0.5rem 0.75rem 0.5rem 2.375rem",
    border: "1px solid " + COLOR.INPUT.PRIMARY.BORDER,
    borderRadius: "0.375rem",
    fontSize: "1rem",
    lineHeight: "1.5",
    outline: "none",
    transition: "box-shadow 150ms ease, border-color 150ms ease",
    boxSizing: "border-box" as const,
  },
} as const;


