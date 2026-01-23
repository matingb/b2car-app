"use client";

import { useState, useRef, useEffect } from "react";
import { COLOR } from "@/theme/theme";
import { ChevronDown, X } from "lucide-react";

export interface AutocompleteOption {
  value: string;
  label: string;
  secondaryLabel?: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  allowCustomValue?: boolean;
  dataTestId?: string;
}

export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  disabled = false,
  style,
  allowCustomValue = false,
  dataTestId,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar opciones basadas en el término de búsqueda
  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.secondaryLabel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Encontrar la opción seleccionada
  const selectedOption = options.find((opt) => opt.value === value);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (!allowCustomValue) {
          setSearchTerm("");
        }
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [allowCustomValue]);

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (allowCustomValue && searchTerm.trim()) {
          // Si se permite valor personalizado, usar lo que escribió el usuario
          onChange(searchTerm.trim());
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
        break;
      case "Escape":
        setIsOpen(false);
        if (!allowCustomValue) {
          setSearchTerm("");
        }
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case "Tab":
        setIsOpen(false);
        if (allowCustomValue && searchTerm.trim()) {
          onChange(searchTerm.trim());
        }
        break;
    }
  };

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Si se permite valor personalizado, actualizar en tiempo real
    if (allowCustomValue) {
      onChange(newValue);
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleBlur = () => {
    // Si se permite valor personalizado, asegurar que se guarde lo escrito
    if (allowCustomValue && searchTerm.trim()) {
      onChange(searchTerm.trim());
    }
  };

  return (
    <div ref={containerRef} style={{ ...styles.container, ...style }}>
      <div style={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          data-testid={dataTestId}
          style={{
            ...styles.input,
            ...(disabled && styles.inputDisabled),
          }}
          value={
            isOpen
              ? searchTerm
              : allowCustomValue
              ? value
              : selectedOption?.label || ""
          }
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <div style={styles.iconContainer}>
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={styles.clearButton}
              aria-label="Limpiar"
            >
              <X size={16} color={COLOR.TEXT.SECONDARY} />
            </button>
          )}
          <ChevronDown
            size={18}
            color={disabled ? COLOR.TEXT.TERTIARY : COLOR.TEXT.SECONDARY}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div style={styles.dropdown}>
          {filteredOptions.length > 0 ? (
            <div style={styles.optionsList}>
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  style={{
                    ...styles.option,
                    ...(highlightedIndex === index && styles.optionHighlighted),
                    ...(value === option.value && styles.optionSelected),
                  }}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div style={styles.optionContent}>
                    <span style={styles.optionLabel}>{option.label}</span>
                    {option.secondaryLabel && (
                      <span style={styles.optionSecondary}>
                        {option.secondaryLabel}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.spinnerContainer} aria-label="Cargando opciones">
              <div style={styles.spinner} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    width: "100%",
  },
  inputWrapper: {
    position: "relative",
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
    position: "absolute",
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
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    zIndex: 1000,
    maxHeight: 300,
    overflow: "hidden",
  },
  optionsList: {
    maxHeight: 300,
    overflowY: "auto",
  },
  option: {
    padding: "10px 12px",
    cursor: "pointer",
    transition: "background 0.15s",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  optionHighlighted: {
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
  },
  optionSelected: {
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  },
  optionContent: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 500,
  },
  optionSecondary: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  spinnerContainer: {
    padding: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: `2px solid ${COLOR.BORDER.SUBTLE}`,
    borderTopColor: COLOR.ACCENT.PRIMARY,
    animation: "autocomplete-spin 0.8s linear infinite",
  },
} as const;

// Inline keyframes injection for the spinner animation
const styleEl =
  typeof document !== "undefined" ? document.createElement("style") : null;
if (styleEl) {
  styleEl.textContent = `@keyframes autocomplete-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleEl);
}
