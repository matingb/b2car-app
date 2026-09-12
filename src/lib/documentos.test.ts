import { describe, expect, it } from "vitest";
import { isValidDniCuil, normalizeDniCuil } from "./documentos";

describe("documentos de particulares", () => {
  it("normaliza separadores de DNI y CUIL", () => {
    expect(normalizeDniCuil("20-12345678-6")).toBe("20123456786");
    expect(normalizeDniCuil(" ")).toBeNull();
  });

  it("acepta DNI de 7/8 dígitos y CUIL de 11", () => {
    expect(isValidDniCuil("1234567")).toBe(true);
    expect(isValidDniCuil("12345678")).toBe(true);
    expect(isValidDniCuil("20123456786")).toBe(true);
    expect(isValidDniCuil("123456789")).toBe(false);
  });
});
