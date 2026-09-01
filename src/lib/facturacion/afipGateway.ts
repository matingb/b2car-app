import "server-only";

import Afip from "@afipsdk/afip.js";

export type ArcaGatewayConfig = {
  cuit: string;
  cert: string;
  key: string;
  production: boolean;
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
