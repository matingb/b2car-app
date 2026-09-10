"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { TipoCliente } from "@/model/types";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import {
  useArcaPadronLookup,
  type ArcaPadronLookupState,
} from "@/app/hooks/useArcaPadronLookup";
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

function ArcaPadronFeedback({
  lookup,
  onSelectCandidate,
}: {
  lookup: ArcaPadronLookupState;
  onSelectCandidate: (candidate: string) => void;
}) {
  if (lookup.status === "IDLE") return null;
  if (lookup.status === "LOADING") {
    return <span style={styles.lookupPending}>Consultando datos en ARCA...</span>;
  }
  if (lookup.status === "FOUND") {
    return (
      <div style={styles.lookupFound} role="status">
        <strong>Datos encontrados en ARCA</strong>
        <span>{lookup.person.nombreCompleto} · {lookup.person.cuit}</span>
        {lookup.person.direccion ? <span>{lookup.person.direccion}</span> : null}
        <small>Revisalos antes de guardar.</small>
      </div>
    );
  }
  if (lookup.status === "MULTIPLE") {
    return (
      <div style={styles.lookupFound} role="status">
        <strong>El DNI tiene más de una clave fiscal asociada</strong>
        <label style={styles.lookupCandidateLabel}>
          Elegí el CUIL para completar los datos
          <select
            defaultValue=""
            style={styles.input}
            onChange={(event) => {
              if (event.target.value) onSelectCandidate(event.target.value);
            }}
          >
            <option value="" disabled>Seleccionar CUIL</option>
            {lookup.candidates.map((candidate) => <option value={candidate} key={candidate}>{candidate}</option>)}
          </select>
        </label>
      </div>
    );
  }
  return (
    <span style={lookup.status === "NOT_FOUND" ? styles.lookupPending : styles.lookupError}>
      {lookup.message}
    </span>
  );
}

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
  const lookupDocumentType = value.tipo_cliente === TipoCliente.EMPRESA
    ? 80
    : Number(value.tipoDocumentoFiscal) as 80 | 86 | 96;
  const lookupDocumentNumber = value.tipo_cliente === TipoCliente.EMPRESA
    ? value.cuit
    : value.numeroDocumentoFiscal;
  const lookup = useArcaPadronLookup({
    documentType: lookupDocumentType,
    documentNumber: lookupDocumentNumber,
  });
  const appliedLookup = useRef<string | null>(null);

  useEffect(() => {
    if (lookup.status !== "FOUND") return;
    const lookupKey = `${value.tipo_cliente}:${lookup.person.cuit}`;
    if (appliedLookup.current === lookupKey) return;
    appliedLookup.current = lookupKey;

    if (value.tipo_cliente === TipoCliente.EMPRESA) {
      onChange({
        nombre: lookup.person.razonSocial ?? lookup.person.nombreCompleto,
        cuit: lookup.person.cuit,
        ...(lookup.person.direccion ? { direccion: lookup.person.direccion } : {}),
      });
      return;
    }

    onChange({
      nombre: lookup.person.nombre,
      ...(lookup.person.apellido ? { apellido: lookup.person.apellido } : {}),
      ...(lookup.person.direccion ? { direccion: lookup.person.direccion } : {}),
    });
  }, [lookup, onChange, value.tipo_cliente]);

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
          <div style={styles.fiscalTitle}>Perfil fiscal</div>
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
          <ArcaPadronFeedback
            lookup={lookup}
            onSelectCandidate={(candidate) => onChange({
              tipoDocumentoFiscal: "86",
              numeroDocumentoFiscal: candidate,
            })}
          />
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
  fiscalHint: {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    color: COLOR.TEXT.TERTIARY,
    fontSize: 13,
  },
  lookupPending: {
    color: COLOR.TEXT.TERTIARY,
    fontSize: 12,
  },
  lookupError: {
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 12,
    lineHeight: 1.4,
  },
  lookupFound: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 3,
    padding: "9px 10px",
    borderRadius: 6,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    lineHeight: 1.35,
  },
  lookupCandidateLabel: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
    fontSize: 12,
  },
} as const;
