import { describe, expect, it } from "vitest";
import { mapCuenta, rpcErrorMessage, rpcStatus, validateCreateIngresoManual, validateUpdateCuenta, validateUuid } from "./finanzasRouteUtils";

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

describe("rpcStatus", () => {
  it("traduce el rechazo de permisos de la base a 403", () => {
    expect(rpcStatus({ code: "42501" })).toBe(403);
  });
});

describe("validateCreateIngresoManual", () => {
  const validInput = {
    cuentaId: "11111111-1111-4111-8111-111111111111",
    importe: 1250.5,
    fecha: "2026-09-24T23:55:00-03:00",
    descripcion: "  Aporte de capital  ",
    idempotencyKey: "55555555-5555-4555-8555-555555555555",
  };

  it("valida los campos y conserva el timestamp ISO con su zona horaria", () => {
    expect(validateCreateIngresoManual(validInput)).toEqual({
      value: {
        ...validInput,
        descripcion: "Aporte de capital",
      },
    });
  });

  it.each([0, -1, 1.001, 1_000_000_000_000])("rechaza importe inválido: %s", (importe) => {
    expect(validateCreateIngresoManual({ ...validInput, importe }).error).toBeTruthy();
  });

  it.each([undefined, "2026-09-24", "2026-02-30T12:00:00-03:00", "no-es-fecha"])(
    "requiere una fecha ISO completa y válida (%s)",
    (fecha) => {
      expect(validateCreateIngresoManual({ ...validInput, fecha }).error).toContain("fecha");
    }
  );

  it.each([undefined, "   ", "x".repeat(2_001)])("requiere un concepto válido", (descripcion) => {
    expect(validateCreateIngresoManual({ ...validInput, descripcion }).error).toContain("descripcion");
  });
});
