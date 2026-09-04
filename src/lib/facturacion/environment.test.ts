import { afterEach, describe, expect, it, vi } from "vitest";
import { FacturacionValidationError } from "./arcaPayload";
import {
  getFacturacionAmbiente,
  getFceMipymeMontoMinimo,
  reachesFceMipymeLimit,
} from "./environment";

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

  it("exige un límite FCE global positivo", () => {
    vi.stubEnv("FCE_MIPYME_MONTO_MINIMO", "");
    expect(getFceMipymeMontoMinimo).toThrow(FacturacionValidationError);

    vi.stubEnv("FCE_MIPYME_MONTO_MINIMO", "1000000.5");
    expect(getFceMipymeMontoMinimo()).toBe(1_000_000.5);
  });

  it("bloquea el importe igual o mayor al límite FCE", () => {
    vi.stubEnv("FCE_MIPYME_MONTO_MINIMO", "1000");
    expect(reachesFceMipymeLimit(999.99)).toBe(false);
    expect(reachesFceMipymeLimit(1000)).toBe(true);
    expect(reachesFceMipymeLimit(1000.01)).toBe(true);
  });
});
