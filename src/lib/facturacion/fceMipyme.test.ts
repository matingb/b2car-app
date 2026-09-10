import { describe, expect, it } from "vitest";
import {
  assertFceMipymeAllowed,
  FceMipymeQueryError,
  FceMipymeRequiredError,
  parseFceMipymeRequirement,
} from "./fceMipyme";

const response = (obligado: "S" | "N", montoDesde?: number) => ({
  consultarMontoObligadoRecepcionReturn: {
    obligado,
    ...(montoDesde == null ? {} : { montoDesde }),
  },
});

describe("obligación de FCE MiPyME", () => {
  it("continúa cuando el receptor no está obligado", () => {
    const requirement = parseFceMipymeRequirement(response("N"));
    expect(requirement).toEqual({ obligado: false, montoDesde: null });
    expect(() => assertFceMipymeAllowed(requirement, 10_000_000)).not.toThrow();
  });

  it("acepta la variante histórica respuesta de WSFECRED", () => {
    expect(parseFceMipymeRequirement({
      consultarMontoObligadoRecepcionReturn: { respuesta: "N" },
    })).toEqual({ obligado: false, montoDesde: null });
  });

  it("continúa para un receptor obligado debajo del umbral", () => {
    const requirement = parseFceMipymeRequirement(response("S", 5_500_000));
    expect(() => assertFceMipymeAllowed(requirement, 5_499_999.99)).not.toThrow();
  });

  it("bloquea de manera inclusiva exactamente en el umbral", () => {
    const requirement = parseFceMipymeRequirement(response("S", 5_500_000));
    expect(() => assertFceMipymeAllowed(requirement, 5_500_000)).toThrow(FceMipymeRequiredError);
  });

  it("bloquea por encima del umbral", () => {
    const requirement = parseFceMipymeRequirement(response("S", 5_500_000));
    expect(() => assertFceMipymeAllowed(requirement, 8_000_000)).toThrow(FceMipymeRequiredError);
  });

  it("falla de forma segura ante errores o una respuesta incompleta de ARCA", () => {
    expect(() => parseFceMipymeRequirement({
      consultarMontoObligadoRecepcionReturn: {
        arrayErrores: { codigoDescripcion: [{ descripcion: "Servicio no disponible" }] },
      },
    })).toThrow(FceMipymeQueryError);
    expect(() => parseFceMipymeRequirement(response("S"))).toThrow(FceMipymeQueryError);
  });
});
