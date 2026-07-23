"use client";

import React, { useMemo } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useEmpleados } from "@/app/providers/EmpleadosProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  value: string | null;
  onChange: (empleadoId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

import { getInitials } from "@/lib/initials";

export default function EmpleadoSelect({ value, onChange, disabled, placeholder = "+ Empleado" }: Props) {
  const { empleados } = useEmpleados();

  const options = useMemo<AutocompleteOption[]>(
    () => empleados.map((e) => ({ value: e.id, label: `${e.nombre} ${e.apellido}`.trim() })),
    [empleados]
  );

  const selectedOption = value ? empleados.find((e) => e.id === value) : null;
  const label = selectedOption ? `${selectedOption.nombre} ${selectedOption.apellido}`.trim() : (value || "");
  const isSelected = !!value;

  const dynamicWidth = `calc(${label.length}ch + 32px)`;

  return (
    <div style={{ position: "relative", display: "inline-flex", width: dynamicWidth, minWidth: 150, maxWidth: "100%" }}>
      {isSelected && (
        <div style={styles.avatarOverlay}>
          {getInitials(label || "")}
        </div>
      )}
      <Autocomplete
        options={options}
        value={value ?? ""}
        onChange={(next) => onChange(next.trim() || null)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: "100%" }}
        inputStyle={{
          backgroundColor: isSelected ? COLOR.BACKGROUND.INFO_TINT : COLOR.BACKGROUND.PRIMARY,
          color: isSelected ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY,
          border: isSelected ? "1px solid transparent" : `1px dashed ${COLOR.BORDER.SUBTLE}`,
          borderRadius: 999,
          padding: isSelected ? "4px 28px 4px 26px" : "4px 28px 4px 12px",
          height: 28,
          fontSize: 12,
          fontWeight: 500,
          boxShadow: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
}

const styles = {
  avatarOverlay: {
    position: "absolute",
    left: 6,
    top: "50%",
    transform: "translateY(-50%)",
    width: 16,
    height: 16,
    borderRadius: 999,
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
    pointerEvents: "none",
    zIndex: 10,
  }
} as const;
