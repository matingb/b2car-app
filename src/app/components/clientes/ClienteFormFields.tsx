"use client";

import React, { useEffect, useMemo } from "react";
import Dropdown from "@/app/components/ui/Dropdown";
import type { DropdownOption } from "@/app/components/ui/Dropdown";
import { TipoCliente } from "@/model/types";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";

export type ClienteFormFieldsValue = {
  nombre: string;
  apellido: string;
  cuit: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: TipoCliente;
};

export type ClienteFormErrors = Partial<Record<"nombre" | "apellido" | "cuit", string>>;

export function requiredClienteFields(tipo: TipoCliente): Array<keyof ClienteFormFieldsValue> {
  return tipo === TipoCliente.EMPRESA
    ? ["nombre", "cuit", "tipo_cliente"]
    : ["nombre", "apellido", "tipo_cliente"];
}

export function validateClienteForm(values: Pick<ClienteFormFieldsValue, "nombre" | "apellido" | "cuit" | "tipo_cliente">): {
  isValid: boolean;
  errors: ClienteFormErrors;
} {
  const errors: ClienteFormErrors = {};

  if (values.nombre.trim().length === 0) errors.nombre = "Campo obligatorio";
  if (values.tipo_cliente === TipoCliente.PARTICULAR && values.apellido.trim().length === 0) errors.apellido = "Campo obligatorio";
  if (values.tipo_cliente === TipoCliente.EMPRESA && values.cuit.trim().length === 0) errors.cuit = "Campo obligatorio";

  return { isValid: Object.keys(errors).length === 0, errors };
}

type Props = {
  value: ClienteFormFieldsValue;
  onChange: (patch: Partial<ClienteFormFieldsValue>) => void;
  disableTipo?: boolean;
  onValidityChange?: (result: {
    isValid: boolean;
    errors: ClienteFormErrors;
  }) => void;
};

const tipoClienteOptions = [
  { value: TipoCliente.PARTICULAR, label: "Particular" },
  { value: TipoCliente.EMPRESA, label: "Empresa" },
] satisfies DropdownOption[];

export default function ClienteFormFields({
  value,
  onChange,
  disableTipo,
  onValidityChange,
}: Props) {
  const validation = useMemo(
    () =>
      validateClienteForm({
        nombre: value.nombre,
        apellido: value.apellido,
        cuit: value.cuit,
        tipo_cliente: value.tipo_cliente,
      }),
    [value.nombre, value.apellido, value.cuit, value.tipo_cliente]
  );

  useEffect(() => {
    onValidityChange?.(validation);
  }, [validation, onValidityChange]);

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>
              Nombre{" "}
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            </label>
            <input
              style={styles.input}
              placeholder={
                value.tipo_cliente === TipoCliente.EMPRESA
                  ? "Nombre de la empresa"
                  : "Nombre del cliente"
              }
              value={value.nombre}
              onChange={(e) => onChange({ nombre: e.target.value })}
            />
          </div>

          {value.tipo_cliente === TipoCliente.PARTICULAR && (
            <div style={styles.field}>
              <label style={styles.label}>
                Apellido{" "}
                <span aria-hidden="true" style={styles.required}>
                  *
                </span>
              </label>
              <input
                style={styles.input}
                placeholder="Apellido"
                value={value.apellido}
                onChange={(e) => onChange({ apellido: e.target.value })}
              />
            </div>
          )}

          {value.tipo_cliente === TipoCliente.EMPRESA && (
            <div style={styles.field}>
              <label style={styles.label}>
                CUIT{" "}
                <span aria-hidden="true" style={styles.required}>
                  *
                </span>
              </label>
              <input
                style={styles.input}
                placeholder="99-12345678-9"
                value={value.cuit}
                onChange={(e) => onChange({ cuit: e.target.value })}
              />
            </div>
          )}

          <div style={{ ...styles.field, maxWidth: 160 }}>
            <label style={styles.label}>
              Tipo{" "}
              <span aria-hidden="true" style={styles.required}>
                *
              </span>
            </label>
            <Dropdown
              value={value.tipo_cliente}
              options={tipoClienteOptions}
              onChange={(v) => onChange({ tipo_cliente: v as TipoCliente })}
              disabled={Boolean(disableTipo)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Teléfono</label>
            <input
              style={styles.input}
              placeholder="+54 11 1234–5678"
              value={value.telefono}
              onChange={(e) => onChange({ telefono: e.target.value })}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              placeholder="email@ejemplo.com"
              value={value.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 1 }}>
            <label style={styles.label}>Dirección</label>
            <input
              style={styles.input}
              placeholder="Dirección completa"
              value={value.direccion}
              onChange={(e) => onChange({ direccion: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "4px 0 12px",
  },
  wrapper: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    display: "flex",
    gap: 16,
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
    color: COLOR.TEXT.PRIMARY,
  },
} as const;
