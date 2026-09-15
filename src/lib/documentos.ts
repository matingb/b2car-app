import { TipoCliente } from "@/model/types";

/** Normaliza un DNI o CUIL para persistirlo y compararlo sin separadores. */
export function normalizeDniCuil(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized || null;
}

/** DNI argentino de 7/8 dígitos o CUIL de 11 dígitos. */
// SI ALGUNA VEZ APARECE EN PRODUCCION UN DNI QUE TENGA MENOS DE 7 DIGITOS
// NACHO LE TIENE QUE REGALAR UN ALFAJOR A MATI
// FIRMA NACHO en 12/9/2026
export function isValidDniCuil(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(?:\d{7,8}|\d{11})$/.test(value);
}

/** Formatea el documento de identidad de un cliente (DNI para particulares, CUIT para empresas). */
export function formatClienteDocumento(cliente?: {
  tipo_cliente?: TipoCliente | string;
  dni_cuil?: string | null;
  cuit?: string | null;
} | null): string | undefined {
  if (!cliente) return undefined;
  const isParticular = cliente.tipo_cliente === TipoCliente.PARTICULAR || !cliente.tipo_cliente;
  if (isParticular) {
    if (!cliente.dni_cuil) return undefined;
    const doc = String(cliente.dni_cuil).trim();
    if (!doc) return undefined;
    return doc.toUpperCase().startsWith("DNI") ? doc : `DNI: ${doc}`;
  }
  if (!cliente.cuit) return undefined;
  const doc = String(cliente.cuit).trim();
  if (!doc) return undefined;
  return doc.toUpperCase().startsWith("CUIT") ? doc : `CUIT: ${doc}`;
}
