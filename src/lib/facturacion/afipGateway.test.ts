import { afterEach, describe, expect, it, vi } from "vitest";
import { FceMipymeQueryError } from "./fceMipyme";
import { createArcaGateway, getWsfecredB2carConfig } from "./afipGateway";

vi.mock("server-only", () => ({}));

const afipState = vi.hoisted(() => ({
  configs: [] as Record<string, unknown>[],
  getVoucherTypes: vi.fn(),
  getSalesPoints: vi.fn(),
}));

vi.mock("@afipsdk/afip.js", () => ({
  default: class {
    ElectronicBilling = {
      getLastVoucher: vi.fn(),
      getVoucherTypes: afipState.getVoucherTypes,
      getSalesPoints: afipState.getSalesPoints,
      getVoucherInfo: vi.fn(),
      createVoucher: vi.fn(),
      getServerStatus: vi.fn(),
    };

    constructor(config: Record<string, unknown>) {
      afipState.configs.push(config);
    }

    WebService() {
      return {
        getTokenAuthorization: vi.fn().mockResolvedValue({ token: "token", sign: "sign" }),
        executeRequest: vi.fn().mockResolvedValue({
          consultarMontoObligadoRecepcionReturn: { obligado: "N" },
        }),
      };
    }
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  afipState.configs.length = 0;
});

describe("credenciales institucionales para WSFECRED", () => {
  it("usa exclusivamente las variables de B2Car y normaliza CUIT y PEM", () => {
    vi.stubEnv("B2CAR_ARCA_CUIT", "30-12345678-9");
    vi.stubEnv("B2CAR_ARCA_CERT", " CERTIFICADO\\nB2CAR ");
    vi.stubEnv("B2CAR_ARCA_KEY", " CLAVE\\nB2CAR ");

    expect(getWsfecredB2carConfig()).toEqual({
      cuit: "30123456789",
      cert: "CERTIFICADO\nB2CAR",
      key: "CLAVE\nB2CAR",
    });
  });

  it("falla de forma segura si falta una credencial institucional", () => {
    vi.stubEnv("B2CAR_ARCA_CUIT", "30123456789");
    vi.stubEnv("B2CAR_ARCA_CERT", "CERTIFICADO");
    vi.stubEnv("B2CAR_ARCA_KEY", "");

    expect(getWsfecredB2carConfig).toThrow(FceMipymeQueryError);
  });

  it("mantiene el cliente del tenant para WSFE y crea otro para WSFECRED", async () => {
    vi.stubEnv("AFIPSDK_ACCESS_TOKEN", "token-afip-sdk");
    vi.stubEnv("B2CAR_ARCA_CUIT", "30123456789");
    vi.stubEnv("B2CAR_ARCA_CERT", "CERTIFICADO B2CAR");
    vi.stubEnv("B2CAR_ARCA_KEY", "CLAVE B2CAR");

    const gateway = await createArcaGateway({
      cuit: "20111222333",
      cert: "CERTIFICADO TENANT",
      key: "CLAVE TENANT",
      production: false,
    });
    await gateway.getFceMipymeRequirement("30777888999", "2026-09-10");

    expect(afipState.configs).toEqual([
      expect.objectContaining({
        CUIT: "20111222333",
        cert: "CERTIFICADO TENANT",
        key: "CLAVE TENANT",
      }),
      expect.objectContaining({
        CUIT: "30123456789",
        cert: "CERTIFICADO B2CAR",
        key: "CLAVE B2CAR",
      }),
    ]);
  });

  it("usa los metodos de parametros WSFE para tipos de comprobante y puntos de venta", async () => {
    vi.stubEnv("AFIPSDK_ACCESS_TOKEN", "token-afip-sdk");
    afipState.getVoucherTypes.mockResolvedValue([{ Id: 11, Desc: "Factura C" }]);
    afipState.getSalesPoints.mockResolvedValue([{ Nro: 3 }]);

    const gateway = await createArcaGateway({
      cuit: "20111222333",
      cert: "CERTIFICADO TENANT",
      key: "CLAVE TENANT",
      production: false,
    });

    await expect(gateway.getVoucherTypes()).resolves.toEqual([{ Id: 11, Desc: "Factura C" }]);
    await expect(gateway.getSalesPoints()).resolves.toEqual([{ Nro: 3 }]);
    expect(afipState.getVoucherTypes).toHaveBeenCalledOnce();
    expect(afipState.getSalesPoints).toHaveBeenCalledOnce();
  });
});
