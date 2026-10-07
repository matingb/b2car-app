"use client";

import ClienteAutocomplete from "@/app/components/clientes/ClienteAutocomplete";
import Dropdown from "@/app/components/ui/Dropdown";
import { CONDICIONES_IVA_RECEPTOR } from "@/lib/facturacion/types";
import { REMITO_DOCUMENTO_TIPOS, type RemitoDestinatario } from "@/lib/remitos/types";
import { TipoCliente, type Cliente } from "@/model/types";
import { remitoFormStyles as styles } from "./remitoFormStyles";

export type DestinatarioForm = {
  clienteId: string;
  nombre: string;
  domicilio: string;
  tipoDocumento: "" | "80" | "86" | "96";
  numeroDocumento: string;
  condicionIvaReceptorId: string;
};

export const DESTINATARIO_VACIO: DestinatarioForm = {
  clienteId: "",
  nombre: "",
  domicilio: "",
  tipoDocumento: "",
  numeroDocumento: "",
  condicionIvaReceptorId: "",
};

/** Precarga desde un destinatario ya conocido (por ejemplo, el receptor de la factura). */
export function destinatarioFormDesde(destinatario: RemitoDestinatario): DestinatarioForm {
  return {
    clienteId: destinatario.clienteId ?? "",
    nombre: destinatario.nombre,
    domicilio: destinatario.domicilio ?? "",
    tipoDocumento: destinatario.tipoDocumento ? String(destinatario.tipoDocumento) as DestinatarioForm["tipoDocumento"] : "",
    numeroDocumento: destinatario.numeroDocumento ?? "",
    condicionIvaReceptorId: destinatario.condicionIvaReceptorId ? String(destinatario.condicionIvaReceptorId) : "",
  };
}

/** Precarga desde la ficha del cliente: empresa → CUIT; particular → DNI o CUIL según la longitud. */
export function destinatarioFormDesdeCliente(cliente: Cliente, actual: DestinatarioForm): DestinatarioForm {
  const empresa = cliente.tipo_cliente === TipoCliente.EMPRESA;
  const documento = String((empresa ? cliente.cuit : cliente.dni_cuil) ?? "").replace(/\D/g, "");
  const tipoDocumento: DestinatarioForm["tipoDocumento"] = !documento
    ? ""
    : empresa ? "80" : documento.length === 11 ? "86" : "96";
  return {
    ...actual,
    clienteId: cliente.id,
    nombre: cliente.nombre,
    domicilio: cliente.direccion ?? "",
    tipoDocumento,
    numeroDocumento: documento,
  };
}

/** Payload para la API: vacíos a `null` y tipos numéricos. */
export function destinatarioPayload(form: DestinatarioForm) {
  return {
    clienteId: form.clienteId || null,
    nombre: form.nombre.trim(),
    domicilio: form.domicilio.trim() || null,
    tipoDocumento: form.tipoDocumento ? Number(form.tipoDocumento) : null,
    numeroDocumento: form.tipoDocumento ? form.numeroDocumento.replace(/\D/g, "") || null : null,
    condicionIvaReceptorId: form.condicionIvaReceptorId ? Number(form.condicionIvaReceptorId) : null,
  };
}

const DOCUMENTO_OPTIONS = [
  { value: "", label: "Sin documento" },
  ...REMITO_DOCUMENTO_TIPOS.map((tipo) => ({ value: String(tipo.id), label: tipo.label })),
];

const CONDICION_OPTIONS = [
  { value: "", label: "Sin especificar" },
  ...CONDICIONES_IVA_RECEPTOR.map((condicion) => ({ value: String(condicion.id), label: condicion.label })),
];

type Props = {
  value: DestinatarioForm;
  onChange: (next: DestinatarioForm) => void;
  disabled?: boolean;
};

export default function RemitoDestinatarioFields({ value, onChange, disabled = false }: Props) {
  const patch = (changes: Partial<DestinatarioForm>) => onChange({ ...value, ...changes });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={styles.field}>
        <label style={styles.label}>Cargar desde un cliente (opcional)</label>
        <ClienteAutocomplete
          value={value.clienteId}
          disabled={disabled}
          placeholder="Buscar cliente para precargar sus datos..."
          dataTestId="remito-destinatario-cliente"
          onChange={(clienteId, cliente) => {
            if (cliente) onChange(destinatarioFormDesdeCliente(cliente, value));
            else patch({ clienteId: clienteId || "" });
          }}
        />
      </div>
      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="remito-destinatario-nombre">
            Apellido y nombre / Razón social <span style={styles.required}>*</span>
          </label>
          <input
            id="remito-destinatario-nombre"
            required
            maxLength={200}
            disabled={disabled}
            value={value.nombre}
            onChange={(event) => patch({ nombre: event.target.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="remito-destinatario-domicilio">Domicilio de entrega</label>
          <input
            id="remito-destinatario-domicilio"
            maxLength={300}
            disabled={disabled}
            value={value.domicilio}
            onChange={(event) => patch({ domicilio: event.target.value })}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="remito-destinatario-tipo-documento">Tipo de documento</label>
          <Dropdown
            id="remito-destinatario-tipo-documento"
            value={value.tipoDocumento}
            options={DOCUMENTO_OPTIONS}
            disabled={disabled}
            onChange={(tipoDocumento) => patch({
              tipoDocumento: tipoDocumento as DestinatarioForm["tipoDocumento"],
              numeroDocumento: tipoDocumento ? value.numeroDocumento : "",
            })}
            style={styles.dropdown}
            dataTestId="remito-destinatario-tipo-documento"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="remito-destinatario-documento">Número de documento</label>
          <input
            id="remito-destinatario-documento"
            inputMode="numeric"
            maxLength={13}
            disabled={disabled || !value.tipoDocumento}
            value={value.numeroDocumento}
            onChange={(event) => patch({ numeroDocumento: event.target.value })}
            placeholder={value.tipoDocumento ? "Solo números" : "Sin documento"}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="remito-destinatario-condicion">Condición frente al IVA</label>
          <Dropdown
            id="remito-destinatario-condicion"
            value={value.condicionIvaReceptorId}
            options={CONDICION_OPTIONS}
            disabled={disabled}
            onChange={(condicionIvaReceptorId) => patch({ condicionIvaReceptorId })}
            style={styles.dropdown}
            dataTestId="remito-destinatario-condicion"
          />
        </div>
      </div>
    </div>
  );
}
