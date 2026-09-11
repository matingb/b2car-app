import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArcaPadronLookupError,
  getArcaPadronB2carConfig,
  lookupArcaPadronPerson,
} from "./arcaPadronGateway";

vi.mock("server-only", () => ({}));

const arcaState = vi.hoisted(() => ({
  configs: [] as Record<string, unknown>[],
  getTaxpayerDetails: vi.fn(),
  getTaxIDByDocument: vi.fn(),
}));

vi.mock("@arcasdk/core", () => ({
  Arca: class {
    registerScopeThirteenService = {
      getTaxpayerDetails: arcaState.getTaxpayerDetails,
      getTaxIDByDocument: arcaState.getTaxIDByDocument,
    };

    constructor(config: Record<string, unknown>) {
      arcaState.configs.push(config);
    }
  },
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

describe("adapter institucional de padrón ARCA", () => {
  it("normaliza sólo las credenciales institucionales de B2Car", () => {
    configureB2carCredentials();

    expect(getArcaPadronB2carConfig()).toMatchObject({
      cuit: 30123456789,
      cert: "CERTIFICADO\nB2CAR",
      key: "CLAVE\nB2CAR",
      production: false,
    });
  });

  it("consulta CUIT mediante Padrón A13 y mapea los datos para la UI", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      tipoPersona: "FISICA",
      estadoClave: "ACTIVO",
      datosGenerales: {
        nombre: "Ana",
        apellido: "Pérez",
        domicilio: [
          { tipoDomicilio: "LEGAL", direccion: "Otra dirección" },
          { tipoDomicilio: "FISCAL", direccion: "Av. Siempre Viva 123" },
        ],
      },
    });

    await expect(lookupArcaPadronPerson(80, "20-12345678-6")).resolves.toEqual({
      status: "FOUND",
      person: {
        cuit: "20123456786",
        tipoPersona: "FISICA",
        estadoClave: "ACTIVO",
        nombre: "Ana",
        apellido: "Pérez",
        razonSocial: null,
        nombreCompleto: "Ana Pérez",
        direccion: "Av. Siempre Viva 123",
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

  it("no elige una clave fiscal arbitraria cuando un DNI devuelve más de una", async () => {
    configureB2carCredentials();
    arcaState.getTaxIDByDocument.mockResolvedValue({
      idPersona: [20123456786, 27123456782],
    });

    await expect(lookupArcaPadronPerson(96, "12345678")).resolves.toEqual({
      status: "MULTIPLE",
      candidates: ["20123456786", "27123456782"],
    });
    expect(arcaState.getTaxpayerDetails).not.toHaveBeenCalled();
  });

  it("resuelve un DNI con una unica clave fiscal antes de consultar la persona", async () => {
    configureB2carCredentials();
    arcaState.getTaxIDByDocument.mockResolvedValue({ idPersona: [20123456786] });
    arcaState.getTaxpayerDetails.mockResolvedValue({
      idPersona: 20123456786,
      tipoPersona: "FISICA",
      estadoClave: "ACTIVO",
      datosGenerales: {
        nombre: "Ana",
        apellido: "Perez",
      },
    });

    await expect(lookupArcaPadronPerson(96, "12345678")).resolves.toMatchObject({
      status: "FOUND",
      person: {
        cuit: "20123456786",
        nombre: "Ana",
        apellido: "Perez",
      },
    });
    expect(arcaState.getTaxIDByDocument).toHaveBeenCalledWith("12345678");
    expect(arcaState.getTaxpayerDetails).toHaveBeenCalledWith(20123456786);
  });

  it("informa que no existe la persona cuando A13 no devuelve datos", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockResolvedValue(null);

    await expect(lookupArcaPadronPerson(80, "20-12345678-6")).rejects.toMatchObject({
      code: "ARCA_PADRON_NOT_FOUND",
    } satisfies Partial<ArcaPadronLookupError>);
  });

  it("encapsula una falla del WS de A13 sin exponer el error del proveedor", async () => {
    configureB2carCredentials();
    arcaState.getTaxpayerDetails.mockRejectedValue(new Error("SOAP unavailable"));

    await expect(lookupArcaPadronPerson(80, "20-12345678-6")).rejects.toMatchObject({
      code: "ARCA_PADRON_UNAVAILABLE",
    } satisfies Partial<ArcaPadronLookupError>);
  });

  it("requiere un identificador completo y las credenciales institucionales", async () => {
    await expect(lookupArcaPadronPerson(96, "1234567")).rejects.toMatchObject({
      code: "ARCA_PADRON_INVALID_DOCUMENT",
    } satisfies Partial<ArcaPadronLookupError>);

    vi.stubEnv("B2CAR_ARCA_CUIT", "30123456789");
    await expect(lookupArcaPadronPerson(80, "20123456786")).rejects.toMatchObject({
      code: "ARCA_PADRON_NOT_CONFIGURED",
    } satisfies Partial<ArcaPadronLookupError>);
  });
});
