"use client";

import React, { useMemo } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useTiposArreglo } from "@/app/providers/TiposArregloProvider";

type Props = {
  value: string | null;
  onChange: (tipoArregloId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function TipoArregloSelect({ value, onChange, disabled, placeholder = "+ Categoría" }: Props) {
  const { tipos, createTipo } = useTiposArreglo();

  const options = useMemo<AutocompleteOption[]>(
    () => tipos.map((t) => ({ value: t.id, label: t.nombre })),
    [tipos]
  );

  const handleChange = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }

    const existing = tipos.find((t) => t.id === trimmed);
    if (existing) {
      onChange(existing.id);
      return;
    }

    // No matchea ningun id existente: el usuario escribio un nombre nuevo.
    void createTipo(trimmed).then((res) => {
      if (res.tipo) onChange(res.tipo.id);
    });
  };

  const selectedOption = value ? tipos.find((t) => t.id === value) : null;
  const label = selectedOption ? selectedOption.nombre : (value || "");
  const isSelected = !!value;

  const dynamicWidth = `calc(${label.length}ch + 32px)`;

  return (
    <Autocomplete
      options={options}
      value={value ?? ""}
      onChange={handleChange}
      placeholder={placeholder}
      allowCustomValue
      disabled={disabled}
      style={{
        display: "inline-flex",
        width: dynamicWidth,
        minWidth: 140,
        maxWidth: "100%",
      }}
      inputStyle={{
        backgroundColor: isSelected ? "#f1f5f9" : "#ffffff",
        color: isSelected ? "#475569" : "#64748b",
        border: isSelected ? "1px solid transparent" : "1px dashed #cbd5e1",
        borderRadius: 999,
        padding: "4px 28px 4px 12px",
        height: 28,
        fontSize: 12,
        fontWeight: 500,
        boxShadow: "none",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    />
  );
}
