import "server-only";

import { Arca } from "@arcasdk/core";
import {
  ArcaB2carConfigurationError,
  createArcaB2carClient,
  getArcaB2carConfig,
  type ArcaB2carConfig,
} from "@/lib/arca/arcaB2car";
import type {
  ArcaPadronDocumentType,
  ArcaPadronLookupResult,
  ArcaPadronPerson,
} from "./types";
import { logger } from "@/lib/logger";

type UnknownRecord = Record<string, unknown>;

export class ArcaPadronLookupError extends Error {
  constructor(
    message: string,
    public readonly code: "ARCA_PADRON_INVALID_DOCUMENT" | "ARCA_PADRON_NOT_CONFIGURED" | "ARCA_PADRON_NOT_FOUND" | "ARCA_PADRON_UNAVAILABLE",
  ) {
    super(message);
    this.name = "ArcaPadronLookupError";
  }
}

export type ArcaPadronB2carConfig = ArcaB2carConfig;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

function expectedLength(documentType: ArcaPadronDocumentType): number {
  return documentType === 96 ? 8 : 11;
}

function ensureDocument(documentType: ArcaPadronDocumentType, documentNumber: string): string {
  const normalized = normalizeDocument(documentNumber);
  if (normalized.length !== expectedLength(documentType)) {
    const label = documentType === 96 ? "DNI de 8 dígitos" : "CUIT/CUIL de 11 dígitos";
    throw new ArcaPadronLookupError(`Ingresá un ${label} para consultar el padrón de ARCA`, "ARCA_PADRON_INVALID_DOCUMENT");
  }
  return normalized;
}

/**
 * Compatibilidad del adapter A13 con la configuración institucional compartida.
 */
export function getArcaPadronB2carConfig(): ArcaPadronB2carConfig {
  try {
    return getArcaB2carConfig("b2car-arca-padron-tickets");
  } catch (error) {
    if (!(error instanceof ArcaB2carConfigurationError)) throw error;
    throw new ArcaPadronLookupError(
      "La consulta de padrón ARCA no está configurada. Cargá las credenciales institucionales de B2Car.",
      "ARCA_PADRON_NOT_CONFIGURED",
    );
  }
}

function extractAddress(general: UnknownRecord): string | null {
  const addresses = Array.isArray(general.domicilio) ? general.domicilio : [];
  const selected = addresses
    .map(record)
    .find((address) => text(address.tipoDomicilio).toUpperCase() === "FISCAL")
    ?? addresses.map(record)[0];
  return selected ? nullableText(selected.direccion) : null;
}

function mapPerson(details: unknown, fallbackCuit: string): ArcaPadronPerson {
  const value = record(details);
  const general = record(value.datosGenerales);
  const nombre = text(general.nombre);
  const apellido = nullableText(general.apellido);
  const razonSocial = nullableText(general.razonSocial);
  const nombreCompleto = razonSocial ?? ([nombre, apellido].filter(Boolean).join(" ") || "Contribuyente");

  return {
    cuit: normalizeDocument(text(value.idPersona ?? general.idPersona)) || fallbackCuit,
    tipoPersona: nullableText(value.tipoPersona ?? general.tipoPersona),
    estadoClave: nullableText(value.estadoClave ?? general.estadoClave),
    nombre: nombre || razonSocial || "Contribuyente",
    apellido,
    razonSocial,
    nombreCompleto,
    direccion: extractAddress(general),
  };
}

function createArcaClient(config: ArcaPadronB2carConfig): Arca {
  return createArcaB2carClient(config);
}

async function lookupCuitOrCuil(
  arca: Arca,
  document: string,
): Promise<ArcaPadronLookupResult> {
  const details = await arca.registerScopeThirteenService.getTaxpayerDetails(Number(document));
  if (!details) {
    throw new ArcaPadronLookupError("No se encontraron datos en el padrón de ARCA", "ARCA_PADRON_NOT_FOUND");
  }
  return { status: "FOUND", person: mapPerson(details, document) };
}

async function lookupDni(
  arca: Arca,
  document: string,
): Promise<ArcaPadronLookupResult> {
  const response = await arca.registerScopeThirteenService.getTaxIDByDocument(document);
  const candidates = Array.from(new Set(
    (response.idPersona ?? [])
      .map((candidate) => normalizeDocument(String(candidate)))
      .filter((candidate) => candidate.length === 11),
  ));

  if (!candidates.length) {
    throw new ArcaPadronLookupError("No se encontraron datos en el padrón de ARCA", "ARCA_PADRON_NOT_FOUND");
  }
  if (candidates.length > 1) {
    return { status: "MULTIPLE", candidates };
  }
  return lookupCuitOrCuil(arca, candidates[0]);
}

/**
 * Consulta exclusivamente Padrón A13 con credenciales B2Car.
 * No participa de WSFE ni de WSFECRED y no usa certificados de tenants.
 */
export async function lookupArcaPadronPerson(
  documentType: ArcaPadronDocumentType,
  documentNumber: string,
): Promise<ArcaPadronLookupResult> {
  const document = ensureDocument(documentType, documentNumber);
  const arca = createArcaClient(getArcaPadronB2carConfig());

  try {
    return documentType === 96
      ? await lookupDni(arca, document)
      : await lookupCuitOrCuil(arca, document);
  } catch (error) {
    logger.error("Error al consultar el padrón ARCA", { error });
    if (error instanceof ArcaPadronLookupError) throw error;
    logger.error("Falló la consulta institucional al padrón ARCA");
    throw new ArcaPadronLookupError(
      "El padrón de ARCA no está disponible en este momento. Reintentá en unos minutos.",
      "ARCA_PADRON_UNAVAILABLE",
    );
  }
}
