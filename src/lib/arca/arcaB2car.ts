import "server-only";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { Arca } from "@arcasdk/core";

export class ArcaB2carConfigurationError extends Error {
  constructor() {
    super("La consulta ARCA no está configurada. Cargá las credenciales institucionales de B2Car.");
    this.name = "ArcaB2carConfigurationError";
  }
}

export type ArcaB2carConfig = {
  cuit: number;
  cert: string;
  key: string;
  production: boolean;
  ticketPath: string;
};

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizePem(value: string | undefined): string {
  return (value ?? "").trim().replace(/\\n/g, "\n");
}

/**
 * Credenciales institucionales de B2Car, aisladas de los certificados de cada tenant.
 * ArcaSDK administra los tickets WSAA por servicio dentro de este directorio temporal.
 */
export function getArcaB2carConfig(ticketDirectory = "b2car-arca-tickets"): ArcaB2carConfig {
  const normalizedCuit = normalizeDocument(process.env.B2CAR_ARCA_CUIT ?? "");
  const cert = normalizePem(process.env.B2CAR_ARCA_CERT);
  const key = normalizePem(process.env.B2CAR_ARCA_KEY);

  if (normalizedCuit.length !== 11 || !cert || !key) {
    throw new ArcaB2carConfigurationError();
  }

  return {
    cuit: Number(normalizedCuit),
    cert,
    key,
    production: process.env.ARCA_AMBIENTE === "PRODUCCION",
    ticketPath: join(tmpdir(), ticketDirectory),
  };
}

export function createArcaB2carClient(config = getArcaB2carConfig()): Arca {
  return new Arca({
    cuit: config.cuit,
    cert: config.cert,
    key: config.key,
    production: config.production,
    ticketPath: config.ticketPath,
  });
}
