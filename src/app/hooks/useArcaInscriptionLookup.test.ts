import { describe, expect, it } from "vitest";
import {
  isArcaInscriptionLookupReady,
  normalizeArcaCuit,
} from "./useArcaInscriptionLookup";

describe("disparador de Constancia de Inscripción ARCA", () => {
  it("consulta únicamente cuando el CUIT está completo", () => {
    expect(normalizeArcaCuit("20-12345678-6")).toBe("20123456786");
    expect(isArcaInscriptionLookupReady("20-12345678-6")).toBe(true);
    expect(isArcaInscriptionLookupReady("2012345678")).toBe(false);
    expect(isArcaInscriptionLookupReady("20123456789")).toBe(false);
  });
});
