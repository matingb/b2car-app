import { amountToCents, FacturacionValidationError } from "./arcaPayload";

type UnknownRecord = Record<string, unknown>;

export type FceMipymeRequirement = {
  obligado: boolean;
  montoDesde: number | null;
};

/** La consulta de ARCA es una precondición: no se puede continuar sin una respuesta confiable. */
export class FceMipymeQueryError extends Error {
  readonly code = "FCE_MIPYME_QUERY_UNAVAILABLE";

  constructor(message = "No se pudo consultar la obligación de Factura de Crédito Electrónica MiPyME. Reintentá la emisión.") {
    super(message);
    this.name = "FceMipymeQueryError";
  }
}

export class FceMipymeRequiredError extends FacturacionValidationError {
  readonly code = "FCE_MIPYME_REQUIRED";

  constructor(montoDesde: number) {
    super(
      `El receptor está obligado a recibir Factura de Crédito Electrónica MiPyME para comprobantes desde ${formatAmount(montoDesde)}. El monto de esta factura alcanza o supera ese límite y no puede emitirse como factura electrónica del régimen general.`,
    );
    this.name = "FceMipymeRequiredError";
  }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function errorDescriptions(value: unknown): string[] {
  const row = record(value);
  const entries = [row.codigoDescripcion, row.codigoDescripcionString]
    .flatMap((items) => Array.isArray(items) ? items : items ? [items] : []);
  return entries
    .map((entry) => text(record(entry).descripcion))
    .filter(Boolean);
}

function formatAmount(value: number): string {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

/** Normaliza la respuesta de WSFECRED y rechaza cualquier resultado no determinante. */
export function parseFceMipymeRequirement(response: unknown): FceMipymeRequirement {
  const result = record(record(response).consultarMontoObligadoRecepcionReturn);
  if (!Object.keys(result).length) {
    throw new FceMipymeQueryError("ARCA no devolvió una respuesta válida sobre la obligación de Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
  }

  const errors = [
    ...errorDescriptions(result.arrayErrores),
    ...errorDescriptions(result.arrayErroresFormato),
  ];
  if (errors.length) {
    throw new FceMipymeQueryError(`ARCA no pudo determinar la obligación de Factura de Crédito Electrónica MiPyME: ${errors[0]}`);
  }

  // El manual oficial histórico lo denomina "respuesta" y la referencia actual del SDK, "obligado".
  const obligado = text(result.obligado ?? result.respuesta).toUpperCase();
  if (obligado === "N") return { obligado: false, montoDesde: null };
  if (obligado !== "S") {
    throw new FceMipymeQueryError("ARCA no informó si el receptor está obligado a recibir Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
  }

  const montoDesde = Number(result.montoDesde);
  if (!Number.isFinite(montoDesde) || montoDesde <= 0) {
    throw new FceMipymeQueryError("ARCA no informó un monto válido para la obligación de Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
  }

  try {
    amountToCents(montoDesde);
  } catch {
    throw new FceMipymeQueryError("ARCA informó un monto inválido para la obligación de Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
  }
  return { obligado: true, montoDesde };
}

export function assertFceMipymeAllowed(requirement: FceMipymeRequirement, totalFactura: number): void {
  if (!requirement.obligado) return;
  if (requirement.montoDesde == null) {
    throw new FceMipymeQueryError("ARCA no informó el monto desde el cual el receptor está obligado a recibir Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
  }
  if (amountToCents(totalFactura) >= amountToCents(requirement.montoDesde)) {
    throw new FceMipymeRequiredError(requirement.montoDesde);
  }
}
