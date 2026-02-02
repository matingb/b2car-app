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
}

export type ServiceResult<T> = { data: T | null; error: ServiceError | null };

export function toServiceError(err: PostgrestError): ServiceError {
  const code = (err as { code?: string }).code;
  if (code === "PGRST116") return ServiceError.NotFound;
  if (code === "23505") return ServiceError.Conflict;
  return ServiceError.Unknown;
}

