import { describe, expect, it } from "vitest";
import { isArcaPadronLookupReady } from "./useArcaPadronLookup";

describe("disparador automático de padrón ARCA", () => {
  it("se habilita al completar 8 dígitos para DNI", () => {
    expect(isArcaPadronLookupReady(96, "12.345.678")).toBe(true);
    expect(isArcaPadronLookupReady(96, "1234567")).toBe(false);
    expect(isArcaPadronLookupReady(96, "123456789")).toBe(false);
  });

  it("se habilita al completar 11 dígitos para CUIL o CUIT", () => {
    expect(isArcaPadronLookupReady(80, "20-12345678-6")).toBe(true);
    expect(isArcaPadronLookupReady(86, "27-12345678-2")).toBe(true);
    expect(isArcaPadronLookupReady(80, "2012345678")).toBe(false);
  });
});
