import { FacturacionValidationError } from "./arcaPayload";

/** Reject reuse of an idempotency key with changed content or after the source row was replaced by another retry. */
export function assertIdempotencyReplay(
  registeredIntentHash: string,
  currentIntentHash: string,
  requestedIntentHash: string,
): void {
  if (registeredIntentHash !== requestedIntentHash) {
    throw new FacturacionValidationError("La clave de idempotencia ya fue usada con un contenido diferente");
  }
  if (currentIntentHash !== requestedIntentHash) {
    throw new FacturacionValidationError("La intención original ya fue reemplazada por un reintento con otro contenido; use una clave nueva");
  }
}
