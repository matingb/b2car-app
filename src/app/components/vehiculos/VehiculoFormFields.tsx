"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { useClientes } from "@/app/providers/ClientesProvider";

export type VehiculoFormFieldsValue = {
  cliente_id?: string;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string; // YYYY
  nro_interno: string;
};

export function validateVehiculoForm(
  values: Pick<VehiculoFormFieldsValue, "patente" | "cliente_id">,
  opts: { requireCliente?: boolean } = { requireCliente: false }
): boolean {
  if (values.patente.trim().length === 0) return false;
  if (opts.requireCliente && (!values.cliente_id || values.cliente_id.trim().length === 0)) {
    return false;
  }

  return true;
}

type Props = {
  value: VehiculoFormFieldsValue;
  onChange: (patch: Partial<VehiculoFormFieldsValue>) => void;
  showClienteInput?: boolean;
  tipoCliente?: "particular" | "empresa";
  onValidityChange?: (isValid: boolean) => void;
};

export default function VehiculoFormFields({
  value,
  onChange,
  showClienteInput = false,
  tipoCliente,
  onValidityChange,
}: Props) {
  const { clientes } = useClientes();
  const [clientesOptions, setClientesOptions] = useState<AutocompleteOption[]>([]);
  const selectedClienteId = value.cliente_id ?? "";

  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return undefined;
    return clientes.find((c) => String(c.id) === selectedClienteId);
  }, [clientes, selectedClienteId]);

  const isValid = useMemo(
    () =>
      validateVehiculoForm(
        { cliente_id: selectedClienteId, patente: value.patente },
        { requireCliente: showClienteInput }
      ),
    [selectedClienteId, value.patente, showClienteInput]
  );

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  useEffect(() => {
    if (!showClienteInput) return;
    const opts = clientes.map((c) => ({
      value: String(c.id),
      label: String(
        tipoCliente === "empresa"
          ? c.nombre
          : `${c.nombre} ${"apellido" in c && c.apellido ? c.apellido : ""}`.trim()
      ),
      secondaryLabel: String(c.email || ""),
    }));
    setClientesOptions(opts);
  }, [showClienteInput, clientes, tipoCliente]);

  const showNroInterno =
    selectedCliente?.tipo_cliente === "empresa" ||
    tipoCliente === "empresa" ||
    value.nro_interno.trim().length > 0;

  return (
    <div style={styles.container}>
      {showClienteInput && (
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>
            Cliente <span aria-hidden="true" style={styles.required}>*</span>
          </label>
          <Autocomplete
            options={clientesOptions}
            value={selectedClienteId}
            onChange={(v) => onChange({ cliente_id: v })}
            placeholder="Buscar cliente..."
          />
        </div>
      )}

      <div style={{ padding: "4px 0 12px" }}>
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>
              Patente <span aria-hidden="true" style={styles.required}>*</span>
            </label>
            <input
              style={styles.input}
              placeholder="AAA000 ~ AA000AA"
              value={value.patente}
              onChange={(e) => {
                const noSpaces = e.target.value.replace(/\s/g, "");
                onChange({ patente: noSpaces.toUpperCase() });
              }}
              inputMode="text"
              maxLength={7}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Año patente</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              style={styles.input}
              placeholder="YYYY"
              value={value.fecha_patente}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
                onChange({ fecha_patente: onlyDigits });
              }}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Marca</label>
            <input
              style={styles.input}
              placeholder="Toyota"
              value={value.marca}
              onChange={(e) => onChange({ marca: e.target.value })}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Modelo</label>
            <input
              style={styles.input}
              placeholder="Corolla"
              value={value.modelo}
              onChange={(e) => onChange({ modelo: e.target.value })}
            />
          </div>
          {showNroInterno && (
            <div style={styles.field}>
              <label style={styles.label}>Nro interno</label>
              <input
                style={styles.input}
                placeholder="123"
                value={value.nro_interno}
                onChange={(e) => onChange({ nro_interno: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "4px 0 12px",
  },
  row: {
    display: "flex",
    gap: 16,
    marginTop: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 6,
  },
} as const;
