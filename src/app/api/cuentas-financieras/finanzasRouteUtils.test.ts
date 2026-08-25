import { describe, expect, it } from "vitest";
import { mapCuenta, validateUpdateCuenta, validateUuid } from "./finanzasRouteUtils";

describe("validateUuid", () => {
  it("acepta UUIDs canónicos legacy para consultar registros existentes", () => {
    expect(validateUuid("c0000000-0000-0000-0000-000000000001")).toBeNull();
  });

  it("rechaza valores que no tienen formato UUID", () => {
    expect(validateUuid("cuenta-1")).toBe("id debe ser un UUID válido");
  });
});

describe("cuenta favorita", () => {
  it("valida el cambio de favorita", () => {
    expect(validateUpdateCuenta({ favorita: true })).toEqual({ value: { favorita: true } });
    expect(validateUpdateCuenta({ favorita: "si" })).toEqual({ error: "favorita debe ser booleano" });
  });

  it("mapea la marca favorita devuelta por la RPC", () => {
    expect(mapCuenta({
      id: "c0000000-0000-0000-0000-000000000001",
      nombre: "Caja",
      tipo: "EFECTIVO",
      saldo_inicial: 0,
      saldo: 100,
      activo: true,
      favorita: true,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
    })?.favorita).toBe(true);
  });
});
