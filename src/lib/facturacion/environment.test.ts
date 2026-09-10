import { afterEach, describe, expect, it, vi } from "vitest";
import { getFacturacionAmbiente } from "./environment";

afterEach(() => vi.unstubAllEnvs());

describe("getFacturacionAmbiente", () => {
  it("usa homologación si ARCA_AMBIENTE no está definida o no es válida", () => {
    vi.stubEnv("ARCA_AMBIENTE", "");
    expect(getFacturacionAmbiente()).toBe("HOMOLOGACION");

    vi.stubEnv("ARCA_AMBIENTE", "otro-valor");
    expect(getFacturacionAmbiente()).toBe("HOMOLOGACION");
  });

  it("habilita producción solo con el valor explícito", () => {
    vi.stubEnv("ARCA_AMBIENTE", "PRODUCCION");
    expect(getFacturacionAmbiente()).toBe("PRODUCCION");
  });
});
