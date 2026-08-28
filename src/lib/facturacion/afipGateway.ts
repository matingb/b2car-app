import "server-only";

import Afip from "@afipsdk/afip.js";

export type ArcaGatewayConfig = {
  cuit: string;
  cert: string;
  key: string;
};

export type ArcaGateway = {
  getLastVoucher: (puntoVenta: number, tipoComprobante: number) => Promise<number>;
  getVoucherInfo: (
    numero: number,
    puntoVenta: number,
    tipoComprobante: number,
  ) => Promise<Record<string, unknown> | null>;
  createVoucher: (
    payload: Record<string, unknown>,
  ) => Promise<{ CAE: string; CAEFchVto: string }>;
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
    production: false,
  });

  return {
    async getLastVoucher(puntoVenta, tipoComprobante) {
      return Number(await client.ElectronicBilling.getLastVoucher(puntoVenta, tipoComprobante));
    },
    async getVoucherInfo(numero, puntoVenta, tipoComprobante) {
      return (await client.ElectronicBilling.getVoucherInfo(
        numero,
        puntoVenta,
        tipoComprobante,
      )) as Record<string, unknown> | null;
    },
    async createVoucher(payload) {
      return (await client.ElectronicBilling.createVoucher(payload)) as {
        CAE: string;
        CAEFchVto: string;
      };
    },
    async getServerStatus() {
      return (await client.ElectronicBilling.getServerStatus()) as Record<string, unknown>;
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
