"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { COLOR } from "@/theme/theme";

export type DropdownMultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: DropdownMultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  dataTestId?: string;
};

export default function DropdownMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  disabled = false,
  style,
  inputStyle,
  dataTestId,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabels = useMemo(() => {
    const set = new Set(value);
    return options.filter((o) => set.has(o.value)).map((o) => o.label);
  }, [options, value]);

  const displayValue = useMemo(() => {
    if (selectedLabels.length === 0) return "";
    if (selectedLabels.length === 1) return selectedLabels[0] ?? "";
    return `${selectedLabels.length} seleccionadas`;
  }, [selectedLabels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !dropdownRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || disabled) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;
      const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 8);
      const spaceAbove = Math.max(0, rect.top - 8);
      const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, placeAbove ? spaceAbove : spaceBelow);

      setDropdownStyle(
        placeAbove
          ? {
              position: "fixed",
              bottom: viewportHeight - rect.top + 4,
              left: rect.left,
              width: rect.width,
              maxHeight,
              zIndex: 2000,
            }
          : {
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              maxHeight,
              zIndex: 2000,
            }
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, disabled]);

  const toggleValue = (v: string) => {
    const set = new Set(value);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange(Array.from(set));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div ref={containerRef} style={{ ...styles.container, ...(style ?? {}) }}>
      <div style={styles.inputWrapper} onClick={() => !disabled && setIsOpen((p) => !p)}>
        <input
          ref={inputRef}
          type="text"
          readOnly
          data-testid={dataTestId}
          style={{
            ...styles.input,
            ...(inputStyle ?? {}),
            ...(disabled ? styles.inputDisabled : null),
          }}
          value={displayValue}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div style={styles.iconContainer}>
          {value.length > 0 && !disabled && (
            <button type="button" onClick={handleClear} style={styles.clearButton} aria-label="Limpiar">
              <X size={16} color={COLOR.TEXT.SECONDARY} />
            </button>
          )}
          <ChevronDown
            size={18}
            color={disabled ? COLOR.TEXT.TERTIARY : COLOR.TEXT.SECONDARY}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              cursor: "pointer",
            }}
            onClick={() => !disabled && setIsOpen((p) => !p)}
          />
        </div>
      </div>

      {isOpen && !disabled
        ? typeof document !== "undefined"
          ? createPortal(
              <div ref={dropdownRef} style={{ ...styles.dropdown, ...(dropdownStyle ?? {}) }}>
                <div style={styles.optionsList}>
                  {options.map((opt) => {
                    const checked = value.includes(opt.value);
                    return (
                      <label key={opt.value} style={styles.option}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(opt.value)}
                          style={styles.checkbox}
                        />
                        <span style={styles.optionLabel}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>,
              document.body
            )
          : null
        : null}
    </div>
  );
}

const styles = {
  container: {
    position: "relative" as const,
    width: "100%",
  },
  inputWrapper: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "10px 76px 10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    cursor: "pointer",
  },
  inputDisabled: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    cursor: "not-allowed",
    color: COLOR.TEXT.TERTIARY,
  },
  iconContainer: {
    position: "absolute" as const,
    right: 8,
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
  },
  clearButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    transition: "background 0.2s",
  },
  dropdown: {
    position: "fixed" as const,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    zIndex: 2000,
    overflow: "hidden",
  },
  optionsList: {
    maxHeight: 300,
    overflowY: "auto" as const,
    padding: 6,
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    cursor: "pointer",
    borderRadius: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: COLOR.ACCENT.PRIMARY,
  } as const,
  optionLabel: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 500,
  },
} as const;

