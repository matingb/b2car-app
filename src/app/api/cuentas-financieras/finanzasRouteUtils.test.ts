import { describe, expect, it } from "vitest";
import { validateUuid } from "./finanzasRouteUtils";

describe("validateUuid", () => {
  it("acepta UUIDs canónicos legacy para consultar registros existentes", () => {
    expect(validateUuid("c0000000-0000-0000-0000-000000000001")).toBeNull();
  });

  it("rechaza valores que no tienen formato UUID", () => {
    expect(validateUuid("cuenta-1")).toBe("id debe ser un UUID válido");
  });
});
