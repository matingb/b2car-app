import "server-only";

import Afip from "@afipsdk/afip.js";
import {
  FceMipymeQueryError,
  parseFceMipymeRequirement,
  type FceMipymeRequirement,
} from "./fceMipyme";
import { logger } from "../logger";

export type ArcaGatewayConfig = {
  cuit: string;
  cert: string;
  key: string;
  production: boolean;
};

type WsfecredB2carConfig = Pick<ArcaGatewayConfig, "cuit" | "cert" | "key">;

function normalizePem(value: string | undefined): string {
  return (value ?? "").replace(/\\n/g, "\n").trim();
}

/**
 * WSFECRED usa un certificado institucional de B2Car. La emisión WSFE mantiene
 * las credenciales fiscales del tenant recibidas en ArcaGatewayConfig.
 */
export function getWsfecredB2carConfig(): WsfecredB2carConfig {
  const cuit = (process.env.B2CAR_ARCA_CUIT ?? "").replace(/\D/g, "");
  const cert = normalizePem(process.env.B2CAR_ARCA_CERT);
  const key = normalizePem(process.env.B2CAR_ARCA_KEY);

  if (!/^\d{11}$/.test(cuit) || !cert || !key) {
    throw new FceMipymeQueryError(
      "Falta configurar las credenciales institucionales de B2Car para consultar Factura de Crédito Electrónica MiPyME.",
    );
  }

  return { cuit, cert, key };
}

export type ArcaGateway = {
  getLastVoucher: (puntoVenta: number, tipoComprobante: number) => Promise<number>;
  getVoucherTypes: () => Promise<unknown>;
  getSalesPoints: () => Promise<unknown>;
  getVoucherInfo: (
    numero: number,
    puntoVenta: number,
    tipoComprobante: number,
  ) => Promise<Record<string, unknown> | null>;
  createVoucher: (
    payload: Record<string, unknown>,
  ) => Promise<{ CAE: string; CAEFchVto: string }>;
  getFceMipymeRequirement: (
    cuitReceptor: string,
    fechaEmision: string,
  ) => Promise<FceMipymeRequirement>;
  getServerStatus: () => Promise<Record<string, unknown>>;
};

export async function createArcaGateway(config: ArcaGatewayConfig): Promise<ArcaGateway> {
  const accessToken = process.env.AFIPSDK_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Falta configurar AFIPSDK_ACCESS_TOKEN");
  if (!config.cert.trim() || !config.key.trim()) {
    throw new Error("Las credenciales fiscales activas estan vacias");
  }

  const client = new Afip({
    CUIT: config.cuit,
    cert: config.cert,
    key: config.key,
    access_token: accessToken,
    production: config.production,
  });

  const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`${label}: ARCA no respondió dentro de 25 segundos`)),
            25_000,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  return {
    async getLastVoucher(puntoVenta, tipoComprobante) {
      return Number(await withTimeout(
        client.ElectronicBilling.getLastVoucher(puntoVenta, tipoComprobante),
        "Consulta de último comprobante",
      ));
    },
    async getVoucherTypes() {
      return withTimeout(
        client.ElectronicBilling.getVoucherTypes(),
        "Consulta de tipos de comprobante",
      );
    },
    async getSalesPoints() {
      return withTimeout(
        client.ElectronicBilling.getSalesPoints(),
        "Consulta de puntos de venta",
      );
    },
    async getVoucherInfo(numero, puntoVenta, tipoComprobante) {
      return (await withTimeout(
        client.ElectronicBilling.getVoucherInfo(numero, puntoVenta, tipoComprobante),
        "Consulta de comprobante",
      )) as Record<string, unknown> | null;
    },
    async createVoucher(payload) {
      return (await withTimeout(client.ElectronicBilling.createVoucher(payload), "Autorización de comprobante")) as {
        CAE: string;
        CAEFchVto: string;
      };
    },
    async getFceMipymeRequirement(cuitReceptor, fechaEmision) {
      try {
        const wsfecredConfig = getWsfecredB2carConfig();
        const wsfecredClient = new Afip({
          CUIT: wsfecredConfig.cuit,
          cert: wsfecredConfig.cert,
          key: wsfecredConfig.key,
          access_token: accessToken,
          production: config.production,
        });
        const service = wsfecredClient.WebService("wsfecred");
        const auth = await withTimeout(service.getTokenAuthorization(), "Autenticación para consulta FCE MiPyME") as {
          token?: unknown;
          sign?: unknown;
        };
        const token = typeof auth.token === "string" ? auth.token : "";
        const sign = typeof auth.sign === "string" ? auth.sign : "";
        if (!token || !sign) {
          throw new FceMipymeQueryError("No se pudo autenticar la consulta de Factura de Crédito Electrónica MiPyME. Reintentá la emisión.");
        }
        const response = await withTimeout(service.executeRequest("consultarMontoObligadoRecepcion", {
          authRequest: {
            token,
            sign,
            cuitRepresentada: Number(wsfecredConfig.cuit),
          },
          cuitConsultada: Number(cuitReceptor),
          fechaEmision,
        }), "Consulta de obligación FCE MiPyME");
        return parseFceMipymeRequirement(response);
      } catch (error) {
        logger.error(error);
        if (error instanceof FceMipymeQueryError) throw error;
        throw new FceMipymeQueryError();
      }
    },
    async getServerStatus() {
      return (await withTimeout(client.ElectronicBilling.getServerStatus(), "Estado del servicio")) as Record<string, unknown>;
    },
  };
}

export function sanitizeFiscalPayload(value: unknown): unknown {
  const sensitive = /cert|key|token|sign|authorization|access[_-]?token/i;
  if (Array.isArray(value)) return value.map(sanitizeFiscalPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        sensitive.test(key) ? "[redacted]" : sanitizeFiscalPayload(nested),
      ]),
    );
  }
  return value;
}
