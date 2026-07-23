"use client";

import React, { useMemo } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useCategoriasArreglo } from "@/app/providers/CategoriasArregloProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  value: string | null;
  onChange: (categoriaArregloId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function CategoriaArregloSelect({ value, onChange, disabled, placeholder = "+ Categoría" }: Props) {
  const { categorias, createCategoria } = useCategoriasArreglo();

  const options = useMemo<AutocompleteOption[]>(
    () => categorias.map((t) => ({ value: t.id, label: t.nombre })),
    [categorias]
  );

  const handleChange = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }

    const existing = categorias.find((t) => t.id === trimmed);
    if (existing) {
      onChange(existing.id);
      return;
    }

    // No matchea ningun id existente: el usuario escribio un nombre nuevo.
    void createCategoria(trimmed).then((res) => {
      if (res.categoria) onChange(res.categoria.id);
    });
  };

  const selectedOption = value ? categorias.find((t) => t.id === value) : null;
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
        backgroundColor: isSelected ? COLOR.BACKGROUND.SUBTLE : COLOR.BACKGROUND.PRIMARY,
        color: isSelected ? COLOR.TEXT.PRIMARY : COLOR.TEXT.SECONDARY,
        border: isSelected ? `1px solid ${COLOR.BORDER.SUBTLE}` : `1px dashed ${COLOR.BORDER.SUBTLE}`,
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
