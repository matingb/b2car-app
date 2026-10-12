"use client";

import { type RemitoDestinatario } from "@/lib/remitos/types";
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

/** Precarga desde un destinatario ya conocido, como el cliente asociado al arreglo. */
export function destinatarioFormDesde(destinatario: RemitoDestinatario): DestinatarioForm {
  const numeroDocumento = destinatario.numeroDocumento ?? "";
  return {
    clienteId: destinatario.clienteId ?? "",
    nombre: destinatario.nombre,
    domicilio: destinatario.domicilio ?? "",
    tipoDocumento: destinatario.tipoDocumento
      ? String(destinatario.tipoDocumento) as DestinatarioForm["tipoDocumento"]
      : tipoDocumentoDesdeNumero(numeroDocumento),
    numeroDocumento,
    condicionIvaReceptorId: destinatario.condicionIvaReceptorId ? String(destinatario.condicionIvaReceptorId) : "",
  };
}

/** Infere el código ARCA por el formato del documento, sin pedir otro selector. */
export function tipoDocumentoDesdeNumero(numero: string): DestinatarioForm["tipoDocumento"] {
  const documento = numero.replace(/\D/g, "");
  if (/^\d{7,8}$/.test(documento)) return "96";
  if (!/^\d{11}$/.test(documento)) return "";

  const prefijo = documento.slice(0, 2);
  if (["20", "23", "24", "27"].includes(prefijo)) return "86";
  if (["30", "33", "34"].includes(prefijo)) return "80";
  return "";
}

/** Payload para la API: vacíos a `null` y tipos numéricos. */
export function destinatarioPayload(form: DestinatarioForm) {
  const numeroDocumento = form.numeroDocumento.replace(/\D/g, "");
  return {
    clienteId: form.clienteId || null,
    nombre: form.nombre.trim(),
    domicilio: form.domicilio.trim() || null,
    tipoDocumento: numeroDocumento && form.tipoDocumento ? Number(form.tipoDocumento) : null,
    numeroDocumento: numeroDocumento && form.tipoDocumento ? numeroDocumento : null,
    condicionIvaReceptorId: form.condicionIvaReceptorId ? Number(form.condicionIvaReceptorId) : null,
  };
}

type Props = {
  value: DestinatarioForm;
  onChange: (next: DestinatarioForm) => void;
  disabled?: boolean;
};

export default function RemitoDestinatarioFields({ value, onChange, disabled = false }: Props) {
  const patch = (changes: Partial<DestinatarioForm>) => onChange({ ...value, ...changes });

  return (
    <div style={styles.grid}>
      <label style={styles.field}>
        <span style={styles.label}>
          Apellido y nombre / Razón social <span style={styles.required}>*</span>
        </span>
        <input
          aria-label="Apellido y nombre / Razón social"
          required
          maxLength={200}
          disabled={disabled}
          value={value.nombre}
          onChange={(event) => patch({ nombre: event.target.value })}
          style={styles.input}
        />
      </label>
      <label style={styles.field}>
        <span style={styles.label}>Domicilio de entrega</span>
        <input
          aria-label="Domicilio de entrega"
          maxLength={300}
          disabled={disabled}
          value={value.domicilio}
          onChange={(event) => patch({ domicilio: event.target.value })}
          style={styles.input}
        />
      </label>
      <label style={styles.field}>
        <span style={styles.label}>Documento (DNI, CUIT o CUIL)</span>
        <input
          aria-label="Número de documento"
          inputMode="numeric"
          maxLength={13}
          disabled={disabled}
          value={value.numeroDocumento}
          onChange={(event) => {
            const numeroDocumento = event.target.value;
            patch({ numeroDocumento, tipoDocumento: tipoDocumentoDesdeNumero(numeroDocumento) });
          }}
          placeholder="Ingresá el documento"
          style={styles.input}
        />
      </label>
    </div>
  );
}
