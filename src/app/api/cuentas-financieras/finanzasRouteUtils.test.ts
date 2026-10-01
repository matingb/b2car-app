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
  it("conserva el mensaje de negocio del error 55000 (ledger inmutable)", () => {
    const error = { code: "55000", message: "Los movimientos del ledger son inmutables." };
    const result = rpcErrorMessage(error, "Error por defecto");
    expect(result).toBe(error.message);
  });

  it("conserva el mensaje de negocio del error 55001 (arreglo facturado)", () => {
    const error = { code: "55001", message: "protegido por factura" };
    const result = rpcErrorMessage(error, "Error por defecto");
    expect(result).toBe(error.message);
  });

  it.each(["22023", "P0001", "P0002"])("conserva el mensaje de las excepciones de negocio %s", (code) => {
    expect(rpcErrorMessage({ code, message: "Las cuentas de origen y destino deben ser distintas" }, "Error por defecto"))
      .toBe("Las cuentas de origen y destino deben ser distintas");
  });

  it("traduce errores técnicos sin exponer mensajes de Postgres", () => {
    expect(rpcErrorMessage({ code: "23505", message: 'duplicate key on table "accounts"' }, "Error por defecto"))
      .toBe("Ya existe un registro con esos datos.");
    expect(rpcErrorMessage({ code: "22P02", message: "invalid input syntax for uuid" }, "Error por defecto"))
      .toBe("Algunos datos no tienen un formato válido.");
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

  it.each(["28000", "PGRST301", "PGRST303"])("traduce el rechazo de autenticación %s a 401", (code) => {
    expect(rpcStatus({ code })).toBe(401);
  });

  it.each([
    [{ code: "P0001", message: "STOCK_INSUFICIENTE" }, 409],
    [{ code: "P0001", message: "JWT sin tenant_id" }, 401],
    [{ code: "P0001", message: "Arreglo no encontrado" }, 404],
    [{ code: "P0001", message: "Concepto requerido" }, 400],
    [{ code: "55001" }, 409],
    [{ code: "P1791" }, 400],
    [{ code: "57014" }, 503],
    [null, 500],
  ] as const)("usa el mapeo común para %j", (error, status) => {
    expect(rpcStatus(error)).toBe(status);
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
