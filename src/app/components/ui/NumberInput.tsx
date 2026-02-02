"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { COLOR } from "@/theme/theme";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: number;
  onValueChange: (next: number) => void;
  minValue?: number;
  /**
   * Permite borrar el contenido mientras se edita.
   * En blur se normaliza al `minValue` (o 0).
   */
  allowEmptyWhileEditing?: boolean;
  /**
   * Permite decimales (mantiene estados intermedios como "0.").
   */
  allowDecimals?: boolean;
};

function clampMin(n: number, minValue: number | undefined) {
  if (typeof minValue !== "number") return n;
  return n < minValue ? minValue : n;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export default function NumberInput({
  value,
  onValueChange,
  minValue,
  allowEmptyWhileEditing = true,
  allowDecimals = true,
  style,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const valueAsText = useMemo(() => {
    // Evitar "NaN"
    if (!isFiniteNumber(value)) return "0";
    return String(value);
  }, [value]);

  const [text, setText] = useState<string>(valueAsText);

  // Sync desde el valor externo cuando no se está editando
  useEffect(() => {
    if (isFocused) return;
    setText(valueAsText);
  }, [isFocused, valueAsText]);

  const normalizeTextToNumber = (raw: string): number => {
    const trimmed = raw.trim();
    const fallback = isFiniteNumber(minValue) ? minValue : 0;
    if (!trimmed || trimmed === "." || trimmed === "-") return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return fallback;
    return clampMin(parsed, minValue);
  };

  const numericPattern = useMemo(() => {
    // Permite: "", "0", "10", "0.", "0.5", ".5" (lo normalizamos a 0.5 en blur)
    if (allowDecimals) return /^(\d+(\.\d*)?|\.\d*)?$/;
    return /^(\d+)?$/;
  }, [allowDecimals]);

  const maybeStripLeadingZeros = (raw: string): string => {
    // Si es un entero con ceros a la izquierda ("0005"), normalizar a "5".
    // Para decimales "0.xxx" se mantiene.
    if (!raw) return raw;
    if (raw.startsWith("0") && raw.length > 1 && raw[1] !== ".") {
      const n = Number(raw);
      if (Number.isFinite(n)) return String(n);
    }
    return raw;
  };

  return (
    <input
      ref={(el) => {
        inputRef.current = el;
      }}
      type="number"
      min={typeof minValue === "number" ? minValue : undefined}
      step={rest.step ?? (allowDecimals ? "0.01" : "1")}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;

        // Dejar borrar si se permite (sin forzar 0 inmediatamente)
        if (allowEmptyWhileEditing && raw === "") {
          setText("");
          return;
        }

        // Validación liviana: rechazar caracteres inválidos
        if (!numericPattern.test(raw)) return;

        const normalizedRaw = maybeStripLeadingZeros(raw);
        setText(normalizedRaw);

        // Evitar emitir cambios en estados intermedios tipo "0." o "."
        if (normalizedRaw === "" || normalizedRaw === "." || normalizedRaw.endsWith(".")) return;

        const next = normalizeTextToNumber(normalizedRaw);
        onValueChange(next);
      }}
      onFocus={(e) => {
        setIsFocused(true);
        // UX: si está en 0, seleccionar todo para reemplazar al tipear
        window.setTimeout(() => {
          const el = inputRef.current;
          if (!el) return;
          if (el.value === "0") el.select();
        }, 0);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        const raw = e.currentTarget.value;
        if (!allowEmptyWhileEditing && raw === "") {
          const fallback = isFiniteNumber(minValue) ? minValue : 0;
          setText(String(fallback));
          onValueChange(fallback);
          onBlur?.(e);
          return;
        }

        const next = normalizeTextToNumber(raw);
        setText(String(next));
        onValueChange(next);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        // Soportar escape para “revertir” al valor actual
        if (e.key === "Escape") {
          setText(valueAsText);
          (e.currentTarget as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
      style={{ ...defaultStyles.input, ...(style ?? {}) }}
      {...rest}
    />
  );
}

const defaultStyles = {
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    fontSize: 14,
    outline: "none",
  },
} as const;

