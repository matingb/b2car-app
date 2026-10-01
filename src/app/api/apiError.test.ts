import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_MESSAGES, type ApiErrorBody, type ApiErrorCode } from "@/lib/apiErrorCodes";
import { logger } from "@/lib/logger";
import { generateUuidV4 } from "@/lib/uuid";
import { ApiError, apiErrorResponse, mapDbError, type DbError } from "./apiError";
import { ServiceError } from "./serviceError";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/uuid", () => ({ generateUuidV4: vi.fn(() => "1234abcd-1111-4111-8111-111111111111") }));

const options = {
  context: "POST /api/example",
  fallback: "No se pudo completar la operación",
  notFoundMessage: "Registro solicitado no encontrado",
};
const technicalMessage = 'technical failure in table "private_table"';
const invalidFormatMessage = "Algunos datos no tienen un formato válido.";
const unauthorizedMessage = "Tu sesión expiró. Volvé a iniciar sesión.";

type MappingCase = {
  name: string;
  error: DbError;
  status: number;
  code: ApiErrorCode;
  message: string;
};

const databaseCases: MappingCase[] = [
  { name: "PGRST116", error: { code: "PGRST116", message: technicalMessage }, status: 404, code: "NOT_FOUND", message: options.notFoundMessage },
  { name: "P0002", error: { code: "P0002", message: "Cuenta no encontrada" }, status: 404, code: "NOT_FOUND", message: "Cuenta no encontrada" },
  { name: "22023", error: { code: "22023", message: "Las cuentas deben ser distintas" }, status: 400, code: "VALIDATION", message: "Las cuentas deben ser distintas" },
  { name: "P1791", error: { code: "P1791", message: "Las horas facturadas no pueden volver a desconocidas" }, status: 400, code: "VALIDATION", message: "Las horas facturadas no pueden volver a desconocidas" },
  ...["22P02", "22003", "22007", "23502", "23514"].map((code): MappingCase => ({
    name: code, error: { code, message: technicalMessage }, status: 400, code: "VALIDATION", message: invalidFormatMessage,
  })),
  { name: "23505", error: { code: "23505", message: technicalMessage }, status: 409, code: "CONFLICT", message: "Ya existe un registro con esos datos." },
  { name: "23503 referenced", error: { code: "23503", message: technicalMessage, details: 'Key (id)=(1) is still referenced from table "children".' }, status: 409, code: "IN_USE", message: "No se puede eliminar porque está en uso por otros registros." },
  { name: "23503 missing reference", error: { code: "23503", message: technicalMessage, details: 'Key (parent_id)=(1) is not present in table "parents".' }, status: 400, code: "VALIDATION", message: "Uno de los datos hace referencia a un registro que no existe." },
  { name: "42501", error: { code: "42501", message: technicalMessage }, status: 403, code: "FORBIDDEN", message: "No tenés permisos para realizar esta acción." },
  ...["28000", "PGRST301", "PGRST303"].map((code): MappingCase => ({
    name: code, error: { code, message: technicalMessage }, status: 401, code: "UNAUTHORIZED", message: unauthorizedMessage,
  })),
  { name: "55000", error: { code: "55000", message: "Los movimientos del ledger son inmutables" }, status: 409, code: "INMUTABLE", message: "Los movimientos del ledger son inmutables" },
  { name: "55001", error: { code: "55001", message: "No se puede modificar una venta con comprobante fiscal autorizado" }, status: 409, code: "INMUTABLE", message: "No se puede modificar una venta con comprobante fiscal autorizado" },
  { name: "57014", error: { code: "57014", message: technicalMessage }, status: 503, code: "TIMEOUT", message: "La operación tardó demasiado. Intentá nuevamente." },
  { name: "P0001 stock", error: { code: "P0001", message: "STOCK_INSUFICIENTE stock_id=1" }, status: 409, code: "STOCK_INSUFICIENTE", message: "Stock insuficiente." },
  { name: "P0001 tenant", error: { code: "P0001", message: "JWT sin tenant_id" }, status: 401, code: "UNAUTHORIZED", message: unauthorizedMessage },
  { name: "P0001 not found", error: { code: "P0001", message: "Arreglo no encontrado" }, status: 404, code: "NOT_FOUND", message: "Arreglo no encontrado" },
  { name: "P0001 feminine not found", error: { code: "P0001", message: "Cuenta no encontrada" }, status: 404, code: "NOT_FOUND", message: "Cuenta no encontrada" },
  { name: "P0001 business validation", error: { code: "P0001", message: "No se puede modificar una venta facturada" }, status: 400, code: "VALIDATION", message: "No se puede modificar una venta facturada" },
  ...["42P01", "PGRST202", "XX000", "UNRECOGNIZED"].map((code): MappingCase => ({
    name: code, error: { code, message: technicalMessage }, status: 500, code: "INTERNAL", message: options.fallback,
  })),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("request references and domain mapping", () => {
  it("uses the supplied reference on 5xx without generating another one", async () => {
    const response = apiErrorResponse(new Error("private error"), { ...options, errorId: "req12345" });
    expect(await response.json()).toMatchObject({ error: options.fallback, errorId: "req12345" });
    expect(generateUuidV4).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("req12345"), expect.objectContaining({ errorId: "req12345" }), expect.any(Error));
  });

  it("never exposes a supplied reference in a 4xx body", async () => {
    const response = apiErrorResponse(new ApiError(400, "Falta nombre", "VALIDATION"), { ...options, errorId: "req12345" });
    expect(await response.json()).toEqual({ error: "Falta nombre", code: "VALIDATION" });
  });

  it("evaluates domain mappings before database, service and ApiError mappings", async () => {
    const mapError = vi.fn(() => ({ status: 409 as const, code: "INMUTABLE" as const, message: "Regla del dominio" }));
    for (const error of [{ code: "23505" }, ServiceError.NotFound, new ApiError(400, "Original", "VALIDATION")]) {
      const response = apiErrorResponse(error, { ...options, mapError });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "Regla del dominio", code: "INMUTABLE" });
      expect(mapError).toHaveBeenCalledWith(error);
    }
  });

  it("falls back to the common mapping when the domain mapping returns null", async () => {
    const response = apiErrorResponse({ code: "23505" }, { ...options, mapError: () => null });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("CONFLICT");
  });

  it("protects internal messages even when a domain mapper returns a raw 500", async () => {
    const response = apiErrorResponse(new Error("private"), {
      ...options, mapError: () => ({ status: 500, code: "INTERNAL", message: "private" }),
    });
    expect((await response.json()).error).toBe(options.fallback);
  });
});

describe.each(databaseCases)("database error $name", ({ error, status, code, message }) => {
  it("maps the status, public code and safe message", () => {
    expect(mapDbError(error, options)).toEqual({ status, code, message });
  });

  it("returns a string error and adds a logged reference only on 5xx", async () => {
    const response = apiErrorResponse(error, options);
    const body = await response.json() as ApiErrorBody;

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.error).toBe(message);
    expect(body.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain(technicalMessage);

    if (status >= 500) {
      expect(body.errorId).toBe("1234abcd");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(body.errorId!),
        expect.objectContaining({ errorId: body.errorId, status, code }),
        error,
      );
      expect(logger.warn).not.toHaveBeenCalled();
    } else {
      expect(body).not.toHaveProperty("errorId");
      expect(generateUuidV4).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(options.context),
        expect.objectContaining({ status, code }),
      );
      expect(logger.error).not.toHaveBeenCalled();
    }
  });
});

describe("mapDbError options and incomplete errors", () => {
  it.each([
    { message: 'duplicate key value violates unique constraint "uq_category_name"' },
    { constraint: "uq_category_name" },
    { details: 'violates unique constraint "uq_category_name"' },
  ])("uses an exact constraint message (%j)", (fields) => {
    expect(mapDbError({ code: "23505", ...fields }, {
      constraintMessages: { uq_category_name: "Ya existe una categoría con ese nombre" },
    })).toEqual({ status: 409, code: "CONFLICT", message: "Ya existe una categoría con ese nombre" });
  });

  it("does not use another constraint's message", () => {
    expect(mapDbError({ code: "23505", message: 'constraint "uq_category_name_other"' }, {
      constraintMessages: { uq_category_name: "Ya existe una categoría con ese nombre" },
    }).message).toBe(API_ERROR_MESSAGES.CONFLICT);
  });

  it.each([null, undefined, "unexpected", 42, {}, new Error(technicalMessage)])("handles an unexpected value: %s", (error) => {
    expect(mapDbError(error, options)).toEqual({ status: 500, code: "INTERNAL", message: options.fallback });
  });

  it("provides safe defaults when no message options are given", () => {
    expect(mapDbError(null)).toEqual({ status: 500, code: "INTERNAL", message: API_ERROR_MESSAGES.INTERNAL });
    expect(mapDbError({ code: "PGRST116" }).message).toBe("No se encontró el registro solicitado.");
    expect(mapDbError({ code: "P0002", message: "  " }, options).message).toBe(options.notFoundMessage);
    expect(mapDbError({ code: "22023", message: null }, options).message).toBe(options.fallback);
    expect(mapDbError({ code: "P0001" }, options)).toEqual({ status: 400, code: "VALIDATION", message: options.fallback });
  });
});

describe("legacy ServiceError compatibility", () => {
  it.each([
    [ServiceError.NotFound, 404, "NOT_FOUND", options.notFoundMessage],
    [ServiceError.NoClienteAsignado, 404, "NOT_FOUND", options.notFoundMessage],
    [ServiceError.Conflict, 409, "CONFLICT", "Ya existe un registro con esos datos."],
    [ServiceError.StockInsuficiente, 409, "STOCK_INSUFICIENTE", "Stock insuficiente."],
    [ServiceError.ArregloFacturado, 409, "INMUTABLE", "El arreglo ya posee una factura electrónica autorizada y sus datos fiscales no se pueden modificar"],
    [ServiceError.MovimientoFinancieroInmutable, 409, "INMUTABLE", "Los movimientos financieros registrados no se pueden modificar ni eliminar"],
    [ServiceError.HorasFacturadasInmutables, 400, "VALIDATION", "Las horas facturadas ya definidas no pueden volver a desconocidas"],
    [ServiceError.Unknown, 500, "INTERNAL", options.fallback],
  ] as const)("maps %s", async (error, status, code, message) => {
    const response = apiErrorResponse(error, options);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message, code, ...(status >= 500 ? { errorId: "1234abcd" } : {}) });
  });
});

describe("apiErrorResponse", () => {
  it("keeps the original internal error and its stack in the log, not in the response", async () => {
    const error = Object.assign(new Error(technicalMessage), { code: "XX000", details: "database detail", hint: "database hint" });
    const response = apiErrorResponse(error, { ...options, extra: { operacionId: "op-1" } });

    expect(await response.json()).toEqual({ error: options.fallback, code: "INTERNAL", errorId: "1234abcd" });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("1234abcd"),
      expect.objectContaining({ errorId: "1234abcd", dbCode: "XX000", dbMessage: technicalMessage, details: "database detail", hint: "database hint", operacionId: "op-1" }),
      error,
    );
    expect(error.stack).toContain(technicalMessage);
  });

  it("logs a 4xx database rejection without the original error or its stack", () => {
    const error = Object.assign(new Error("Concepto requerido"), { code: "22023", details: "business detail", hint: "business hint" });
    apiErrorResponse(error, { ...options, extra: { cuentaId: "cuenta-1" } });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(options.context),
      expect.objectContaining({ status: 400, code: "VALIDATION", dbCode: "22023", dbMessage: "Concepto requerido", details: "business detail", hint: "business hint", cuentaId: "cuenta-1" }),
    );
    expect(vi.mocked(logger.warn).mock.calls[0]).toHaveLength(2);
    expect(vi.mocked(logger.warn).mock.calls[0][1]).not.toHaveProperty("stack");
  });

  it("preserves existing response fields while protecting the common error contract", async () => {
    const response = apiErrorResponse({ code: "42501" }, {
      ...options,
      body: { data: [], page: { hasMore: false }, error: { message: "legacy error" }, code: "raw", errorId: "untrusted" },
    });
    expect(await response.json()).toEqual({ data: [], page: { hasMore: false }, error: API_ERROR_MESSAGES.FORBIDDEN, code: "FORBIDDEN" });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("legacy error");
  });

  it("replaces an existing errorId with the generated 5xx reference", async () => {
    const response = apiErrorResponse(new Error(technicalMessage), { ...options, body: { data: null, errorId: "old-id" } });
    expect(await response.json()).toEqual({ data: null, error: options.fallback, code: "INTERNAL", errorId: "1234abcd" });
  });

  it("accepts an explicit business ApiError", async () => {
    const response = apiErrorResponse(new ApiError(409, "El registro ya está cerrado", "CONFLICT"), options);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "El registro ya está cerrado", code: "CONFLICT" });
  });

  it("hides even an explicit ApiError message on 5xx", async () => {
    const response = apiErrorResponse(new ApiError(500, technicalMessage, "INTERNAL"), options);
    expect(await response.json()).toEqual({ error: options.fallback, code: "INTERNAL", errorId: "1234abcd" });
  });
});
