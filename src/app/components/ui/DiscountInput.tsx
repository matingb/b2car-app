"use client";

import React, { useEffect, useState } from "react";
import { COLOR } from "@/theme/theme";
import NumberInput from "./NumberInput";

export type DiscountMode = "amount" | "percent";

type Props = {
  subtotal: number;
  descuento: number;
  onDescuentoChange: (descuentoMonto: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  compact?: boolean;
};

export default function DiscountInput({
  subtotal,
  descuento,
  onDescuentoChange,
  disabled = false,
  ariaLabel = "Descuento",
  dataTestId,
  style,
  inputStyle,
  compact = false,
}: Props) {
  const [mode, setMode] = useState<DiscountMode>("amount");
  const [percentVal, setPercentVal] = useState<number>(0);

  useEffect(() => {
    if (subtotal > 0 && descuento > 0) {
      const pct = Math.round((descuento / subtotal) * 10000) / 100;
      setPercentVal(pct);
    } else if (descuento === 0) {
      setPercentVal(0);
    }
  }, [descuento, subtotal]);

  const handleToggleMode = () => {
    if (disabled) return;
    const nextMode = mode === "amount" ? "percent" : "amount";
    setMode(nextMode);
    if (nextMode === "percent") {
      if (subtotal > 0 && descuento > 0) {
        setPercentVal(Math.round((descuento / subtotal) * 10000) / 100);
      } else {
        setPercentVal(0);
      }
    }
  };

  const handlePercentChange = (pct: number) => {
    const porcentajeAjustado = Math.max(0, Math.min(100, pct));
    setPercentVal(porcentajeAjustado);
    const calculatedAmount =
      subtotal > 0
        ? Math.round(subtotal * (porcentajeAjustado / 100) * 100) / 100
        : 0;
    onDescuentoChange(calculatedAmount);
  };

  const handleAmountChange = (amt: number) => {
    const maxVal = subtotal > 0 ? subtotal : Infinity;
    const montoAjustado = Math.max(0, Math.min(maxVal, amt));
    onDescuentoChange(montoAjustado);
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        position: "relative",
        borderRadius: 6,
        gap: 2,
        ...style,
      }}
      data-testid={dataTestId}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggleMode}
        title={mode === "amount" ? "Cambiar a porcentaje (%)" : "Cambiar a monto ($)"}
        style={{
          border: `1px solid ${COLOR.BORDER.DEFAULT}`,
          background: COLOR.BACKGROUND.SECONDARY,
          color: mode === "percent" ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY,
          fontWeight: 700,
          fontSize: compact ? 11 : 12,
          padding: "2px 6px",
          borderRadius: 4,
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: compact ? 26 : 30,
        }}
      >
        {mode === "amount" ? "$" : "%"}
      </button>

      {mode === "amount" ? (
        <NumberInput
          value={descuento}
          onValueChange={handleAmountChange}
          minValue={0}
          allowDecimals
          disabled={disabled}
          aria-label={ariaLabel}
          style={{
            minWidth: compact ? 50 : 65,
            width: "100%",
            ...inputStyle,
          }}
        />
      ) : (
        <NumberInput
          value={percentVal}
          onValueChange={handlePercentChange}
          minValue={0}
          allowDecimals
          disabled={disabled}
          aria-label={`${ariaLabel} porcentaje`}
          style={{
            minWidth: compact ? 50 : 65,
            width: "100%",
            ...inputStyle,
          }}
        />
      )}
    </div>
  );
}
