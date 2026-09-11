import "server-only";

import {
  ArcaB2carConfigurationError,
  createArcaB2carClient,
  getArcaB2carConfig,
} from "@/lib/arca/arcaB2car";
import { isValidCuitCuil, normalizeDocumentNumber } from "@/lib/facturacion/arcaPayload";
import type { CondicionIvaReceptorId } from "@/lib/facturacion/types";
import { logger } from "@/lib/logger";
import type {
  ArcaInscriptionLookupResult,
  ArcaInscriptionVatCondition,
} from "./types";

type UnknownRecord = Record<string, unknown>;

type ArcaInscriptionErrorCode =
  | "ARCA_INSCRIPTION_INVALID_CUIT"
  | "ARCA_INSCRIPTION_NOT_CONFIGURED"
  | "ARCA_INSCRIPTION_NOT_FOUND"
  | "ARCA_INSCRIPTION_UNAVAILABLE";

const ACTIVE_TAX_STATES = new Set(["AC", "ACTIVO", "ACTIVA"]);

const IVA_CONDITIONS = new Map<number, Pick<ArcaInscriptionVatCondition, "condicionIvaReceptorId" | "condicionIvaLabel">>([
  [30, { condicionIvaReceptorId: 1, condicionIvaLabel: "Responsable inscripto" }],
  [32, { condicionIvaReceptorId: 4, condicionIvaLabel: "IVA exento" }],
  [34, { condicionIvaReceptorId: 15, condicionIvaLabel: "IVA no alcanzado" }],
]);

export class ArcaInscriptionLookupError extends Error {
  constructor(message: string, public readonly code: ArcaInscriptionErrorCode) {
    super(message);
    this.name = "ArcaInscriptionLookupError";
  }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeCuit(value: string): string {
  return normalizeDocumentNumber(value);
}

function ensureCuit(value: string): string {
  const cuit = normalizeCuit(value);
  if (!isValidCuitCuil(cuit)) {
    throw new ArcaInscriptionLookupError(
      "Ingresá un CUIT válido de 11 dígitos para verificar la condición IVA.",
      "ARCA_INSCRIPTION_INVALID_CUIT",
    );
  }
  return cuit;
}

function taxes(section: unknown): UnknownRecord[] {
  const value = record(section).impuesto;
  return Array.isArray(value) ? value.map(record) : [];
}

function isActiveTax(tax: UnknownRecord): boolean {
  return ACTIVE_TAX_STATES.has(text(tax.estadoImpuesto).toUpperCase());
}

function knownConditions(details: unknown): Set<CondicionIvaReceptorId> {
  const payload = record(details);
  const conditions = new Set<CondicionIvaReceptorId>();

  for (const tax of taxes(payload.datosRegimenGeneral)) {
    const condition = IVA_CONDITIONS.get(Number(tax.idImpuesto));
    if (condition && isActiveTax(tax)) conditions.add(condition.condicionIvaReceptorId);
  }

  for (const tax of taxes(payload.datosMonotributo)) {
    if (Number(tax.idImpuesto) === 20 && isActiveTax(tax)) conditions.add(6);
  }

  return conditions;
}

function resultFor(details: unknown, cuit: string): ArcaInscriptionLookupResult {
  const payload = record(details);
  const estadoClave = text(record(payload.datosGenerales).estadoClave).toUpperCase();
  const conditions = knownConditions(payload);

  if (estadoClave && estadoClave !== "ACTIVO") {
    return {
      status: "UNDETERMINED",
      cuit,
      message: "ARCA informó una clave fiscal inactiva; no se pudo determinar su condición IVA.",
    };
  }

  if (conditions.size !== 1) {
    return {
      status: "UNDETERMINED",
      cuit,
      message: "ARCA no devolvió información suficiente para determinar la condición IVA. Seleccionala manualmente o reintentá la consulta.",
    };
  }

  const condicionIvaReceptorId = [...conditions][0];
  const condition = condicionIvaReceptorId === 6
    ? { condicionIvaReceptorId, condicionIvaLabel: "Monotributista" }
    : IVA_CONDITIONS.get(
      condicionIvaReceptorId === 1 ? 30 : condicionIvaReceptorId === 4 ? 32 : 34,
    );

  if (!condition) {
    return {
      status: "UNDETERMINED",
      cuit,
      message: "ARCA no devolvió información suficiente para determinar la condición IVA. Seleccionala manualmente o reintentá la consulta.",
    };
  }

  return {
    status: "FOUND",
    condition: { cuit, ...condition },
  };
}

/**
 * Consulta de Constancia de Inscripción exclusivamente para facturación.
 * ArcaSDK llama getPersona_v2 de ws_sr_constancia_inscripcion y gestiona WSAA
 * con el CUIT, certificado y clave institucionales de B2Car.
 */
export async function lookupArcaInscriptionVatCondition(cuitInput: string): Promise<ArcaInscriptionLookupResult> {
  const cuit = ensureCuit(cuitInput);

  try {
    const arca = createArcaB2carClient(getArcaB2carConfig("b2car-arca-inscripcion-tickets"));
    const details = await arca.registerInscriptionProofService.getTaxpayerDetails(Number(cuit));
    if (!details) {
      throw new ArcaInscriptionLookupError(
        "No se encontró el CUIT en la Constancia de Inscripción de ARCA.",
        "ARCA_INSCRIPTION_NOT_FOUND",
      );
    }
    return resultFor(details, cuit);
  } catch (error) {
    if (error instanceof ArcaInscriptionLookupError) throw error;
    if (error instanceof ArcaB2carConfigurationError) {
      throw new ArcaInscriptionLookupError(
        "La consulta de condición IVA no está configurada. Cargá las credenciales institucionales de B2Car.",
        "ARCA_INSCRIPTION_NOT_CONFIGURED",
      );
    }
    logger.error("Falló la consulta institucional de Constancia de Inscripción ARCA", error);
    throw new ArcaInscriptionLookupError(
      "ARCA no está disponible para verificar la condición IVA. Reintentá en unos minutos.",
      "ARCA_INSCRIPTION_UNAVAILABLE",
    );
  }
}
