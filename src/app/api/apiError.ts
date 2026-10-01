import "server-only";

import { API_ERROR_MESSAGES, type ApiErrorCode } from "@/lib/apiErrorCodes";
import { logger } from "@/lib/logger";
import { generateUuidV4 } from "@/lib/uuid";
import { ServiceError } from "./serviceError";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 500 | 503;

export type DbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  constraint?: string | null;
};

export type DbErrorOptions = {
  fallback?: string;
  notFoundMessage?: string;
  constraintMessages?: Record<string, string>;
};

export type ApiErrorOptions = DbErrorOptions & {
  context: string;
  fallback: string;
  /** Useful record IDs only. Do not include request bodies, secrets or PII. */
  extra?: Record<string, unknown>;
  /** Preserve existing response fields during the gradual route migration. */
  body?: Record<string, unknown>;
};

export type MappedApiError = {
  status: ApiErrorStatus;
  code: ApiErrorCode;
  message: string;
};

const NOT_FOUND_MESSAGE = "No se encontró el registro solicitado.";
const IMMUTABLE_MOVEMENT_MESSAGE = "Los movimientos financieros registrados no se pueden modificar ni eliminar";
const INVOICED_REPAIR_MESSAGE = "El arreglo ya posee una factura electrónica autorizada y sus datos fiscales no se pueden modificar";
const IMMUTABLE_HOURS_MESSAGE = "Las horas facturadas ya definidas no pueden volver a desconocidas";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: ApiErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function dbErrorFields(error: unknown): DbError {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  const read = (field: keyof DbError) => typeof record[field] === "string" ? record[field] as string : undefined;
  return {
    code: read("code"),
    message: read("message"),
    details: read("details"),
    hint: read("hint"),
    constraint: read("constraint"),
  };
}

/** Only application-authored SQL exceptions may expose their original message. */
export function mapDbError(error: unknown, opts: DbErrorOptions = {}): MappedApiError {
  const { code, message, details, constraint } = dbErrorFields(error);
  const fallback = opts.fallback || API_ERROR_MESSAGES.INTERNAL;
  const businessMessage = message?.trim() ? message : fallback;
  const notFoundMessage = opts.notFoundMessage || NOT_FOUND_MESSAGE;

  switch (code) {
    case "PGRST116":
      return { status: 404, code: "NOT_FOUND", message: notFoundMessage };
    case "P0002":
      return { status: 404, code: "NOT_FOUND", message: message?.trim() ? message : notFoundMessage };
    case "22023":
    case "P1791":
      return { status: 400, code: "VALIDATION", message: businessMessage };
    case "22P02":
    case "22003":
    case "22007":
    case "23502":
    case "23514":
      return { status: 400, code: "VALIDATION", message: API_ERROR_MESSAGES.INVALID_FORMAT };
    case "23505": {
      const constraintName = constraint
        || /\bconstraint\s+"([^"]+)"/i.exec(message ?? "")?.[1]
        || /\bconstraint\s+"([^"]+)"/i.exec(details ?? "")?.[1];
      const constraintMessage = constraintName && opts.constraintMessages
        && Object.hasOwn(opts.constraintMessages, constraintName)
        ? opts.constraintMessages[constraintName]
        : undefined;
      return { status: 409, code: "CONFLICT", message: constraintMessage || API_ERROR_MESSAGES.CONFLICT };
    }
    case "23503":
      return /is still referenced/i.test(details ?? "")
        ? { status: 409, code: "IN_USE", message: API_ERROR_MESSAGES.IN_USE }
        : { status: 400, code: "VALIDATION", message: API_ERROR_MESSAGES.INVALID_REFERENCE };
    case "42501":
      return { status: 403, code: "FORBIDDEN", message: API_ERROR_MESSAGES.FORBIDDEN };
    case "28000":
    case "PGRST301":
    case "PGRST303":
      return { status: 401, code: "UNAUTHORIZED", message: API_ERROR_MESSAGES.UNAUTHORIZED };
    case "55000":
      return { status: 409, code: "INMUTABLE", message: message?.trim() ? message : IMMUTABLE_MOVEMENT_MESSAGE };
    case "55001":
      return { status: 409, code: "INMUTABLE", message: message?.trim() ? message : INVOICED_REPAIR_MESSAGE };
    case "57014":
      return { status: 503, code: "TIMEOUT", message: API_ERROR_MESSAGES.TIMEOUT };
    case "P0001":
      if (message?.includes("STOCK_INSUFICIENTE")) {
        return { status: 409, code: "STOCK_INSUFICIENTE", message: API_ERROR_MESSAGES.STOCK_INSUFICIENTE };
      }
      if (message?.includes("JWT sin tenant_id")) {
        return { status: 401, code: "UNAUTHORIZED", message: API_ERROR_MESSAGES.UNAUTHORIZED };
      }
      if (/no encontrad/i.test(message ?? "")) {
        return { status: 404, code: "NOT_FOUND", message: businessMessage };
      }
      return { status: 400, code: "VALIDATION", message: businessMessage };
    default:
      return { status: 500, code: "INTERNAL", message: fallback };
  }
}

function mapServiceError(error: unknown, opts: ApiErrorOptions): MappedApiError | null {
  switch (error) {
    case ServiceError.NotFound:
      return { status: 404, code: "NOT_FOUND", message: opts.notFoundMessage || NOT_FOUND_MESSAGE };
    case ServiceError.NoClienteAsignado:
      return { status: 404, code: "NOT_FOUND", message: opts.notFoundMessage || "Vehículo sin cliente asignado" };
    case ServiceError.Conflict:
      return { status: 409, code: "CONFLICT", message: API_ERROR_MESSAGES.CONFLICT };
    case ServiceError.StockInsuficiente:
      return { status: 409, code: "STOCK_INSUFICIENTE", message: API_ERROR_MESSAGES.STOCK_INSUFICIENTE };
    case ServiceError.ArregloFacturado:
      return { status: 409, code: "INMUTABLE", message: INVOICED_REPAIR_MESSAGE };
    case ServiceError.MovimientoFinancieroInmutable:
      return { status: 409, code: "INMUTABLE", message: IMMUTABLE_MOVEMENT_MESSAGE };
    case ServiceError.HorasFacturadasInmutables:
      return { status: 400, code: "VALIDATION", message: IMMUTABLE_HOURS_MESSAGE };
    case ServiceError.Unknown:
      return { status: 500, code: "INTERNAL", message: opts.fallback };
    default:
      return null;
  }
}

export function apiErrorResponse(error: unknown, opts: ApiErrorOptions): Response {
  const { status, code, message } = error instanceof ApiError
    ? { status: error.status, code: error.code, message: error.status >= 500 ? opts.fallback : error.message }
    : mapServiceError(error, opts) ?? mapDbError(error, opts);
  const errorId = status >= 500 ? generateUuidV4().slice(0, 8) : undefined;
  const dbError = error instanceof ApiError ? {} : dbErrorFields(error);
  const payload = {
    ...opts.extra,
    ...(errorId ? { errorId } : {}),
    status,
    code,
    dbCode: dbError.code,
    dbMessage: dbError.message,
    details: dbError.details,
    hint: dbError.hint,
  };
  const logMessage = `[${opts.context}] ${message}${errorId ? ` (errorId=${errorId})` : ""}`;

  if (status >= 500) {
    logger.error(logMessage, payload, error);
  } else {
    logger.warn(logMessage, payload);
  }

  const body: Record<string, unknown> = { ...opts.body, error: message, code };
  if (errorId) body.errorId = errorId;
  else delete body.errorId;
  return Response.json(body, { status });
}

export function withApiErrors<Args extends unknown[]>(
  context: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiErrorResponse(error, { context, fallback: API_ERROR_MESSAGES.INTERNAL });
    }
  };
}

export function unauthorizedResponse(opts: Partial<ApiErrorOptions> = {}): Response {
  return apiErrorResponse(new ApiError(401, API_ERROR_MESSAGES.UNAUTHORIZED, "UNAUTHORIZED"), {
    ...opts,
    context: opts.context ?? "API",
    fallback: opts.fallback ?? API_ERROR_MESSAGES.UNAUTHORIZED,
  });
}

export function forbiddenResponse(opts: Partial<ApiErrorOptions> = {}): Response {
  return apiErrorResponse(new ApiError(403, API_ERROR_MESSAGES.FORBIDDEN, "FORBIDDEN"), {
    ...opts,
    context: opts.context ?? "API",
    fallback: opts.fallback ?? API_ERROR_MESSAGES.FORBIDDEN,
  });
}
