import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Errores genéricos compartidos entre servicios.
 *
 * Nota: algunos miembros pueden aplicar solo a ciertos flujos (p.ej. NoClienteAsignado),
 * pero se mantienen en un solo enum para que los "clientes" (routes/handlers) resuelvan
 * status y mensajes de forma consistente.
 */
export enum ServiceError {
  NotFound = "NotFound",
  Conflict = "Conflict",
  NoClienteAsignado = "NoClienteAsignado",
  Unknown = "Unknown",
  StockInsuficiente = "Stock Insuficiente",
  ArregloFacturado = "ArregloFacturado",
  MovimientoFinancieroInmutable = "MovimientoFinancieroInmutable",
  HorasFacturadasInmutables = "HorasFacturadasInmutables",
}
export type ServiceResult<T> = {
  data: T | null;
  error: ServiceError | null;
  cause?: PostgrestError | null;
};

/** Preserve the original database error for the route's response and log. */
export function serviceFailure(err: PostgrestError): { error: ServiceError; cause: PostgrestError } {
  return { error: toServiceError(err), cause: err };
}

export function toServiceError(err: PostgrestError): ServiceError {
  const code = err.code;
  if (code == "PGRST116" || code == "P0002") return ServiceError.NotFound;
  if (code == "23505") return ServiceError.Conflict;
  if (code == "55000") return ServiceError.MovimientoFinancieroInmutable;
  if (code == "55001") return ServiceError.ArregloFacturado;
  if (code == "P0001" && err.message?.includes("STOCK_INSUFICIENTE")) return ServiceError.StockInsuficiente;
  if (code == "P1791") return ServiceError.HorasFacturadasInmutables;
  return ServiceError.Unknown;
}

