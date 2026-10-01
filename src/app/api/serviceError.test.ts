import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { ServiceError, serviceFailure, toServiceError, type ServiceResult } from "./serviceError";

function databaseError(code: string, message = "database error"): PostgrestError {
  return Object.assign(new Error(message), { code, details: "original details", hint: "original hint" });
}

describe("toServiceError", () => {
  it("maps the B2C-179 unknown-hours transition to a domain error", () => {
    expect(toServiceError({ code: "P1791" } as never)).toBe(ServiceError.HorasFacturadasInmutables);
  });

  it("only classifies a P0001 exception as stock when its message contains the stock marker", () => {
    expect(toServiceError(databaseError("P0001", "STOCK_INSUFICIENTE stock_id=1"))).toBe(ServiceError.StockInsuficiente);
  });

  it.each(["No se puede modificar una venta con comprobante fiscal autorizado", "JWT sin tenant_id", "Arreglo no encontrado", "Stock disponible inválido"])(
    "does not misclassify a business exception as stock: %s",
    (message) => expect(toServiceError(databaseError("P0001", message))).toBe(ServiceError.Unknown),
  );

  it.each([
    ["PGRST116", ServiceError.NotFound],
    ["P0002", ServiceError.NotFound],
    ["23505", ServiceError.Conflict],
    ["55000", ServiceError.MovimientoFinancieroInmutable],
    ["55001", ServiceError.ArregloFacturado],
    ["XX000", ServiceError.Unknown],
  ])("keeps the existing mapping of %s", (code, expected) => {
    expect(toServiceError(databaseError(code))).toBe(expected);
  });
});

describe("serviceFailure", () => {
  it("preserves the same original error with its message, details, hint and stack", () => {
    const cause = databaseError("22023", "Cuenta financiera requerida");
    const result: ServiceResult<never> = { data: null, ...serviceFailure(cause) };
    expect(result.error).toBe(ServiceError.Unknown);
    expect(result.cause).toBe(cause);
    expect(result.cause?.details).toBe("original details");
    expect(result.cause?.hint).toBe("original hint");
    expect(result.cause?.stack).toContain("Cuenta financiera requerida");
  });

  it("keeps a recognized enum alongside its cause", () => {
    const cause = databaseError("23505");
    expect(serviceFailure(cause)).toEqual({ error: ServiceError.Conflict, cause });
  });

  it("allows legacy service results without a cause", () => {
    const result: ServiceResult<string> = { data: "record-1", error: null };
    expect(result).toEqual({ data: "record-1", error: null });
  });
});
