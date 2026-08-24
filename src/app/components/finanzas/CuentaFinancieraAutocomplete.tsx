"use client";

import React, { useMemo } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { COLOR } from "@/theme/theme";
import type { CuentaFinanciera } from "@/model/finanzas";

export const CREATE_CUENTA_VALUE = "__create_cuenta__";

export interface CuentaFinancieraAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options?: AutocompleteOption[];
  cuentas?: CuentaFinanciera[];
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  createLabel?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  dataTestId?: string;
  hideClearButton?: boolean;
  optionLabelStyle?: React.CSSProperties;
}

const defaultOptionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: COLOR.TEXT.PRIMARY,
};

const EMPTY_CUENTAS: CuentaFinanciera[] = [];

export default function CuentaFinancieraAutocomplete({
  value,
  onChange,
  options: customOptions,
  cuentas,
  placeholder,
  disabled = false,
  allowCreate = true,
  createLabel = "+ Crear cuenta",
  style,
  inputStyle,
  dataTestId,
  hideClearButton = false,
  optionLabelStyle,
}: CuentaFinancieraAutocompleteProps) {
  let cuentasActivas: CuentaFinanciera[] = EMPTY_CUENTAS;
  let loading = false;

  try {
    const ctx = useCuentasFinancieras();
    cuentasActivas = ctx.cuentasActivas ?? EMPTY_CUENTAS;
    loading = ctx.loading ?? false;
  } catch {
    // Si se renderiza fuera del provider (ej. unit tests aislados)
  }

  const options = useMemo<AutocompleteOption[]>(() => {
    if (customOptions) return customOptions;

    const list: AutocompleteOption[] = [];
    if (allowCreate) {
      list.push({
        value: CREATE_CUENTA_VALUE,
        label: createLabel,
        secondaryLabel: "Cargar nueva cuenta financiera",
      });
    }

    const available = (cuentas ?? cuentasActivas).filter((c) => c.activo !== false);
    for (const c of available) {
      list.push({
        value: c.id,
        label: c.nombre,
      });
    }
    return list;
  }, [allowCreate, createLabel, customOptions, cuentas, cuentasActivas]);

  const isInitialLoading = loading && cuentasActivas.length === 0 && !customOptions && !cuentas;
  const defaultPlaceholder = isInitialLoading ? "Cargando cuentas..." : "Seleccionar cuenta...";

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? defaultPlaceholder}
      disabled={disabled || isInitialLoading}
      style={style}
      inputStyle={inputStyle}
      dataTestId={dataTestId}
      hideClearButton={hideClearButton}
      optionLabelStyle={{ ...defaultOptionLabelStyle, ...(optionLabelStyle ?? {}) }}
    />
  );
}
