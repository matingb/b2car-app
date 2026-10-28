import "server-only";

import {
  FacturaRevisionDesactualizadaError,
  FacturacionValidationError,
  FceDataRequiredError,
  issuesFromValidationError,
} from "./facturacionService";

export const FACTURA_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Respuesta de una validación de factura: conserva `error`, `code` y los datos
 * FCE de siempre y agrega los mensajes agrupables en `issues`.
 */
export function facturaValidationErrorResponse(error: FacturacionValidationError): Response {
  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  return Response.json({
    error: error.message,
    code,
    issues: issuesFromValidationError(error),
    ...(error instanceof FceDataRequiredError ? { fce: error.requiredData } : {}),
  }, {
    status: error instanceof FacturaRevisionDesactualizadaError ? 409 : 422,
    headers: FACTURA_NO_STORE_HEADERS,
  });
}
