import { isValidCuitCuil, normalizeDocumentNumber } from "@/lib/facturacion/arcaPayload";
import {
  NOMBRE_CONSUMIDOR_FINAL,
  type FacturaReceptorModo,
  type PerfilFiscalCliente,
} from "@/lib/facturacion/types";

/** Valores de los inputs del receptor fiscal; los selects guardan el id como texto. */
export type ReceptorDraft = {
  modo: FacturaReceptorModo;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  domicilio: string;
  condicionIvaReceptorId: string;
};

type IdentityField = "nombre" | "domicilio" | "condicion";

export type ReceptorState = {
  draft: ReceptorDraft;
  /** Documento completo al que pertenecen nombre, domicilio y condición IVA. */
  identidad: string | null;
  /** Correcciones manuales para esa identidad: una respuesta tardía de ARCA no las pisa. */
  manual: Record<IdentityField, boolean>;
  /** Identidades ya autocompletadas: cada consulta se aplica una sola vez. */
  autocompletado: { padron: string | null; condicion: string | null };
};

const SIN_MANUAL: Record<IdentityField, boolean> = { nombre: false, domicilio: false, condicion: false };

/**
 * Identidad fiscal del documento. CUIT y CUIL comparten número, así que cambiar
 * entre ambos tipos no es otra persona; un DNI incompleto todavía no identifica a nadie.
 */
export function receptorIdentityKey(tipoDocumento: string, numeroDocumento: string): string | null {
  if (tipoDocumento === "99") return "99";
  const digits = normalizeDocumentNumber(numeroDocumento);
  if (tipoDocumento === "80" || tipoDocumento === "86") return isValidCuitCuil(digits) ? `cuit:${digits}` : null;
  if (tipoDocumento === "96") return digits.length === 7 || digits.length === 8 ? `dni:${digits}` : null;
  return null;
}

function anonymousDraft(modo: FacturaReceptorModo): ReceptorDraft {
  return {
    modo, tipoDocumento: "99", numeroDocumento: "", nombre: NOMBRE_CONSUMIDOR_FINAL,
    domicilio: "", condicionIvaReceptorId: "5",
  };
}

function state(draft: ReceptorDraft, identidad: string | null): ReceptorState {
  return { draft, identidad, manual: { ...SIN_MANUAL }, autocompletado: { padron: null, condicion: null } };
}

/** Precarga del cliente del origen. Sin confirmación de ARCA la condición IVA queda sin elegir. */
export function clienteReceptorState(receptor: PerfilFiscalCliente): ReceptorState {
  if (receptor.tipoDocumento === 99 || receptor.tipoDocumento === null) return state(anonymousDraft("CLIENTE"), "99");
  const draft: ReceptorDraft = {
    modo: "CLIENTE",
    tipoDocumento: String(receptor.tipoDocumento),
    numeroDocumento: receptor.numeroDocumento ?? "",
    nombre: receptor.nombre,
    domicilio: receptor.domicilio ?? "",
    condicionIvaReceptorId: receptor.condicionIvaReceptorId ? String(receptor.condicionIvaReceptorId) : "",
  };
  const identidad = receptorIdentityKey(draft.tipoDocumento, draft.numeroDocumento);
  return {
    ...state(draft, identidad),
    autocompletado: { padron: null, condicion: draft.condicionIvaReceptorId ? identidad : null },
  };
}

/** Otro receptor: empieza vacío, sin heredar datos del cliente del origen. */
export function otroReceptorState(): ReceptorState {
  const draft: ReceptorDraft = {
    modo: "OTRO", tipoDocumento: "80", numeroDocumento: "", nombre: "", domicilio: "", condicionIvaReceptorId: "",
  };
  return state(draft, null);
}

/**
 * Cambia el documento. Los datos de identidad pertenecen al documento anterior:
 * si deja de ser el mismo se limpian, aunque se hayan cargado a mano.
 */
export function setReceptorDocumento(current: ReceptorState, tipoDocumento: string, numeroDocumento: string): ReceptorState {
  if (tipoDocumento === "99") return state(anonymousDraft(current.draft.modo), "99");
  const draft = { ...current.draft, tipoDocumento, numeroDocumento };
  const identidad = receptorIdentityKey(tipoDocumento, numeroDocumento);
  if (current.identidad === "99") {
    return state({ ...draft, nombre: "", domicilio: "", condicionIvaReceptorId: "" }, identidad);
  }
  if (identidad === current.identidad) return { ...current, draft };
  // Datos cargados mientras el documento estaba incompleto pasan al documento que se completa.
  if (current.identidad === null) return { ...current, draft, identidad };
  return state({ ...draft, nombre: "", domicilio: "", condicionIvaReceptorId: "" }, identidad);
}

/** Cambia el tipo; en el cliente del origen, volver a su tipo restaura su precarga. */
export function setReceptorTipoDocumento(current: ReceptorState, tipoDocumento: string, precarga: ReceptorState): ReceptorState {
  if (tipoDocumento === current.draft.tipoDocumento) return current;
  if (current.draft.modo === "CLIENTE" && precarga.draft.tipoDocumento === tipoDocumento && tipoDocumento !== "99"
    && current.identidad !== precarga.identidad) {
    return precarga;
  }
  return setReceptorDocumento(current, tipoDocumento, tipoDocumento === "99" ? "" : current.draft.numeroDocumento);
}

export function editReceptorCampo(
  current: ReceptorState,
  campo: "nombre" | "domicilio",
  value: string,
): ReceptorState {
  return { ...current, draft: { ...current.draft, [campo]: value }, manual: { ...current.manual, [campo]: true } };
}

/** Una condición distinta de consumidor final exige CUIT; un CUIL de 11 dígitos sigue siendo la misma persona. */
export function editReceptorCondicion(current: ReceptorState, condicionIvaReceptorId: string): ReceptorState {
  const next: ReceptorState = {
    ...current,
    draft: { ...current.draft, condicionIvaReceptorId },
    manual: { ...current.manual, condicion: true },
  };
  if (condicionIvaReceptorId === "5" || current.draft.tipoDocumento === "80") return next;
  if (current.draft.tipoDocumento === "99") {
    // Deja de ser un consumidor final anónimo: hay que identificar al receptor desde cero.
    return {
      ...state({ ...next.draft, tipoDocumento: "80", numeroDocumento: "", nombre: "", domicilio: "" }, null),
      manual: { ...SIN_MANUAL, condicion: true },
    };
  }
  const numeroDocumento = current.draft.tipoDocumento === "86" ? normalizeDocumentNumber(current.draft.numeroDocumento) : "";
  return {
    ...next,
    draft: { ...next.draft, tipoDocumento: "80", numeroDocumento },
    // Con el CUIT por completar, lo cargado sigue describiendo al mismo receptor.
    identidad: receptorIdentityKey("80", numeroDocumento),
  };
}

/** Nombre y domicilio del padrón: sólo completan campos vacíos y no corregidos de la misma identidad. */
export function applyPadronAutofill(
  current: ReceptorState,
  identidad: string,
  person: { nombre: string | null; domicilio: string | null },
): ReceptorState {
  if (current.identidad !== identidad || current.autocompletado.padron === identidad) return current;
  const draft = { ...current.draft };
  if (person.nombre && !current.manual.nombre && !draft.nombre.trim()) draft.nombre = person.nombre;
  if (person.domicilio && !current.manual.domicilio && !draft.domicilio.trim()) draft.domicilio = person.domicilio;
  return { ...current, draft, autocompletado: { ...current.autocompletado, padron: identidad } };
}

/**
 * Condición IVA de la Constancia de Inscripción. Si no es consumidor final y el
 * receptor se identificó con DNI, pasa al CUIL de esa misma persona como CUIT.
 */
export function applyCondicionAutofill(
  current: ReceptorState,
  identidad: string,
  result: { condicionIvaReceptorId: number; cuit: string },
): ReceptorState {
  if (current.identidad !== identidad || current.autocompletado.condicion === identidad) return current;
  const autocompletado = { ...current.autocompletado, condicion: identidad };
  if (current.manual.condicion) return { ...current, autocompletado };
  const condicionIvaReceptorId = String(result.condicionIvaReceptorId);
  const draft = { ...current.draft, condicionIvaReceptorId };
  if (condicionIvaReceptorId !== "5" && draft.tipoDocumento !== "80") {
    const cuit = normalizeDocumentNumber(result.cuit);
    const nextIdentity = receptorIdentityKey("80", cuit);
    return {
      ...current,
      draft: { ...draft, tipoDocumento: "80", numeroDocumento: cuit },
      identidad: nextIdentity,
      autocompletado: { padron: current.autocompletado.padron === identidad ? nextIdentity : null, condicion: nextIdentity },
    };
  }
  return { ...current, draft, autocompletado };
}

/** Un DNI con varios CUIL se resuelve sólo con la elección explícita del CUIL correcto. */
export function selectReceptorCuil(current: ReceptorState, cuil: string): ReceptorState {
  const numeroDocumento = normalizeDocumentNumber(cuil);
  return {
    ...current,
    draft: { ...current.draft, tipoDocumento: "86", numeroDocumento },
    identidad: receptorIdentityKey("86", numeroDocumento),
    autocompletado: { padron: null, condicion: null },
  };
}
