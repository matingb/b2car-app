"use client";

import React, { useEffect, useMemo } from "react";
import { TipoCliente } from "@/model/types";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import Autocomplete from "../ui/Autocomplete";
import { AutocompleteOption } from "../ui/Autocomplete";
import PhoneInput from "../ui/PhoneInput";

export type ClienteFormFieldsValue = {
  nombre: string;
  apellido: string;
  cuit: string;
  tipoDocumentoFiscal: "80" | "86" | "96";
  numeroDocumentoFiscal: string;
  condicionIvaReceptorId: string;
  fceMipymeAlcanzado: boolean;
  codigoPais: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: TipoCliente;
};

export type ClienteFormErrors = Partial<Record<"nombre" | "apellido" | "cuit", string>>;

export function createEmptyClienteFormFieldsValue(
  tipo_cliente: TipoCliente = TipoCliente.PARTICULAR
): ClienteFormFieldsValue {
  return {
    nombre: "",
    apellido: "",
    cuit: "",
    tipoDocumentoFiscal: tipo_cliente === TipoCliente.EMPRESA ? "80" : "96",
    numeroDocumentoFiscal: "",
    condicionIvaReceptorId: "5",
    fceMipymeAlcanzado: false,
    codigoPais: "54",
    telefono: "",
    email: "",
    direccion: "",
    tipo_cliente,
  };
}


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
] satisfies AutocompleteOption[];

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
            <Autocomplete
              value={value.tipo_cliente}
              options={tipoClienteOptions}
              onChange={(v) => onChange({ tipo_cliente: v as TipoCliente })}
              disabled={Boolean(disableTipo)}
              hideClearButton
            />
          </div>
        </div>

        <PhoneInput
          codigoPais={value.codigoPais}
          telefono={value.telefono}
          onChange={onChange}
        />

        <div style={styles.row}>
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

        <div style={styles.fiscalBox}>
          <div style={styles.fiscalTitle}>Perfil fiscal (puede completarse al facturar)</div>
          <div style={styles.row}>
            {value.tipo_cliente === TipoCliente.PARTICULAR ? (
              <div style={styles.field}>
                <label style={styles.label}>Tipo de documento</label>
                <select style={styles.input} value={value.tipoDocumentoFiscal} onChange={(e) => onChange({ tipoDocumentoFiscal: e.target.value as "80" | "86" | "96" })}>
                  <option value="96">DNI</option>
                  <option value="86">CUIL</option>
                  <option value="80">CUIT</option>
                </select>
              </div>
            ) : null}
            {value.tipo_cliente === TipoCliente.EMPRESA ? (
              <div style={styles.field}>
                <label style={styles.label}>Documento fiscal</label>
                <div style={styles.fiscalHint}>Se utiliza el CUIT obligatorio cargado arriba.</div>
              </div>
            ) : (
              <div style={styles.field}>
                <label style={styles.label}>Número de documento</label>
                <input style={styles.input} inputMode="numeric" value={value.numeroDocumentoFiscal} onChange={(e) => onChange({ numeroDocumentoFiscal: e.target.value })} />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>Condición IVA receptor</label>
              <select style={styles.input} value={value.condicionIvaReceptorId} onChange={(e) => onChange({ condicionIvaReceptorId: e.target.value })}>
                <option value="1">Responsable inscripto</option>
                <option value="4">IVA exento</option>
                <option value="5">Consumidor final</option>
                <option value="6">Monotributista</option>
                <option value="7">Sujeto no categorizado</option>
                <option value="8">Proveedor del exterior</option>
                <option value="9">Cliente del exterior</option>
                <option value="10">IVA liberado - Ley 19.640</option>
                <option value="13">Monotributista social</option>
                <option value="15">IVA no alcanzado</option>
                <option value="16">Monotributo trabajador promovido</option>
              </select>
            </div>
          </div>
          <label style={styles.fceCheckbox}>
            <input
              type="checkbox"
              checked={value.fceMipymeAlcanzado}
              onChange={(event) => onChange({ fceMipymeAlcanzado: event.target.checked })}
            />
            <span>
              Receptor alcanzado por Factura de Crédito Electrónica MiPyME
              <small style={styles.fiscalHint}>La emisión común se bloqueará al superar el monto configurado para evitar un comprobante incorrecto.</small>
            </span>
          </label>
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
    height: "43px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
  },
  codigoPaisInput: {
    width: "60px",
  },
  fiscalBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  fiscalTitle: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 600,
  },
  fceCheckbox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  fiscalHint: {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    color: COLOR.TEXT.TERTIARY,
    fontSize: 13,
  },
} as const;
