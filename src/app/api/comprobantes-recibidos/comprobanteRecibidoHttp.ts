import "server-only";

import { ApiError, type MappedApiError } from "@/app/api/apiError";
import { ServiceError } from "@/app/api/serviceError";
import { parseComprobanteRecibidoInput } from "@/lib/comprobantesRecibidos/input";
import type { ComprobanteRecibidoInput } from "@/lib/comprobantesRecibidos/types";
import type { ComprobanteServiceResult } from "./comprobanteRecibidoService";

export const FACTURA_DUPLICADA_MESSAGE =
  "Ya existe una factura registrada con el mismo CUIT emisor y número de factura. Revisá los datos o buscá la factura existente en Documentos.";

/** 23505 en comprobantes recibidos solo puede ser la factura duplicada (la RPC resuelve la idempotencia). */
export function mapComprobanteRecibidoError(error: unknown): MappedApiError | null {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505") {
    return { status: 409, code: "CONFLICT", message: FACTURA_DUPLICADA_MESSAGE };
  }
  return null;
}

/** Devuelve el dato o lanza el error para que createApiHandler responda con el estado adecuado. */
export function unwrapComprobanteResult<T>(result: ComprobanteServiceResult<T>, fallback: string): T {
  if (result.cause) throw result.cause;
  if (result.error === ServiceError.NotFound) throw new ApiError(404, result.message ?? "No se encontró el documento", "NOT_FOUND");
  if (result.error === ServiceError.Validation) throw new ApiError(400, result.message ?? "Datos inválidos", "VALIDATION");
  if (result.error || result.data === null) throw new ApiError(500, fallback, "INTERNAL");
  return result.data;
}

export function parseComprobanteBody(raw: unknown): ComprobanteRecibidoInput {
  const parsed = parseComprobanteRecibidoInput(raw);
  if (parsed.error || !parsed.value) throw new ApiError(400, parsed.error ?? "Datos inválidos", "VALIDATION");
  return parsed.value;
}
