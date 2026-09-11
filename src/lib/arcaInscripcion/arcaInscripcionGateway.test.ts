import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArcaInscriptionLookupError,
  lookupArcaInscriptionVatCondition,
} from "./arcaInscripcionGateway";

vi.mock("server-only", () => ({}));

const arcaState = vi.hoisted(() => ({
  configs: [] as Record<string, unknown>[],
  getTaxpayerDetails: vi.fn(),
}));

vi.mock("@arcasdk/core", () => ({
  Arca: class {
    registerInscriptionProofService = {
      getTaxpayerDetails: arcaState.getTaxpayerDetails,
    };

    constructor(config: Record<string, unknown>) {
      arcaState.configs.push(config);
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function configureB2carCredentials() {
  vi.stubEnv("B2CAR_ARCA_CUIT", "30-12345678-9");
  vi.stubEnv("B2CAR_ARCA_CERT", " CERTIFICADO\\nB2CAR ");
  vi.stubEnv("B2CAR_ARCA_KEY", " CLAVE\\nB2CAR ");
  vi.stubEnv("ARCA_AMBIENTE", "HOMOLOGACION");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  arcaState.configs.length = 0;
});

describe("adapter de Constancia de Inscripción ARCA", () => {
  it("mapea un IVA activo a Responsable inscripto usando credenciales B2Car", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      datosGenerales: { estadoClave: "ACTIVO" },
      datosRegimenGeneral: {
        impuesto: [{ idImpuesto: 30, estadoImpuesto: "AC" }],
      },
    });

    await expect(lookupArcaInscriptionVatCondition("20-12345678-6")).resolves.toEqual({
      status: "FOUND",
      condition: {
        cuit: "20123456786",
        condicionIvaReceptorId: 1,
        condicionIvaLabel: "Responsable inscripto",
      },
    });
    expect(arcaState.getTaxpayerDetails).toHaveBeenCalledWith(20123456786);
    expect(arcaState.configs).toEqual([
      expect.objectContaining({
        cuit: 30123456789,
        cert: "CERTIFICADO\nB2CAR",
        key: "CLAVE\nB2CAR",
      }),
    ]);
  });

  it("mapea Monotributo activo a la condición que usa facturación", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      datosGenerales: { estadoClave: "ACTIVO" },
      datosMonotributo: {
        impuesto: [{ idImpuesto: 20, estadoImpuesto: "ACTIVO" }],
      },
    });

    await expect(lookupArcaInscriptionVatCondition("20123456786")).resolves.toEqual({
      status: "FOUND",
      condition: {
        cuit: "20123456786",
        condicionIvaReceptorId: 6,
        condicionIvaLabel: "Monotributista",
      },
    });
  });

  it.each([
    [32, 4, "IVA exento"],
    [34, 15, "IVA no alcanzado"],
  ] as const)("mapea el impuesto IVA %i a %s", async (idImpuesto, condicionIvaReceptorId, condicionIvaLabel) => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      datosGenerales: { estadoClave: "ACTIVO" },
      datosRegimenGeneral: {
        impuesto: [{ idImpuesto, estadoImpuesto: "AC" }],
      },
    });

    await expect(lookupArcaInscriptionVatCondition("20123456786")).resolves.toMatchObject({
      status: "FOUND",
      condition: { condicionIvaReceptorId, condicionIvaLabel },
    });
  });

  it("no infiere Consumidor final si la Constancia no permite determinar una condición", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      datosGenerales: { estadoClave: "ACTIVO" },
      datosRegimenGeneral: {
        impuesto: [{ idImpuesto: 30, estadoImpuesto: "BA" }],
      },
    });

    await expect(lookupArcaInscriptionVatCondition("20123456786")).resolves.toMatchObject({
      status: "UNDETERMINED",
      cuit: "20123456786",
    });
  });

  it("distingue una falla temporal del Web Service", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockRejectedValue(new Error("SOAP no disponible"));

    await expect(lookupArcaInscriptionVatCondition("20123456786")).rejects.toMatchObject({
      code: "ARCA_INSCRIPTION_UNAVAILABLE",
    } satisfies Partial<ArcaInscriptionLookupError>);
  });

  it("rechaza CUIT inválido sin consultar ARCA", async () => {
    await expect(lookupArcaInscriptionVatCondition("20123456789")).rejects.toMatchObject({
      code: "ARCA_INSCRIPTION_INVALID_CUIT",
    } satisfies Partial<ArcaInscriptionLookupError>);
    expect(arcaState.getTaxpayerDetails).not.toHaveBeenCalled();
  });
});
