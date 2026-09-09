import { describe, expect, it } from "vitest";
import { mapCuenta, rpcErrorMessage, rpcStatus, validateUpdateCuenta, validateUuid } from "./finanzasRouteUtils";

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

describe("rpcErrorMessage", () => {
  it("depura el error 55000 (ledger inmutable) devolviendo un mensaje claro de negocio al cliente", () => {
    const error = { code: "55000", message: "Los movimientos del ledger son inmutables." };
    const result = rpcErrorMessage(error, "Error por defecto");
    expect(result).toBe("Los movimientos financieros registrados no se pueden modificar ni eliminar");
  });

  it("depura el error 55001 (arreglo facturado)", () => {
    const error = { code: "55001", message: "protegido por factura" };
    const result = rpcErrorMessage(error, "Error por defecto");
    expect(result).toBe("El arreglo ya posee una factura electrónica autorizada y sus datos fiscales no se pueden modificar");
  });

  it("devuelve el mensaje fallback cuando el error es desconocido o null", () => {
    expect(rpcErrorMessage(null, "Error por defecto")).toBe("Error por defecto");
    expect(rpcErrorMessage({ code: "UNKNOWN", message: "tech error" }, "Error por defecto")).toBe("Error por defecto");
  });
});
