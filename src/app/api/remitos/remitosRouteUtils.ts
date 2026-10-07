import "server-only";

import type { Validated } from "@/lib/remitos/remitoValidation";
import { isValidUuid } from "@/lib/uuid";

/** Mensajes para las constraints únicas de remitos (red de seguridad de la numeración e idempotencia). */
export const REMITO_CONSTRAINT_MESSAGES: Record<string, string> = {
  remitos_numero_unico: "El número de remito ya fue utilizado. Revisá el próximo número configurado.",
  remitos_idempotencia_unica: "La emisión ya fue registrada; recargá el remito.",
};

export function parseOptionalFacturaId(raw: string | null): Validated<string | null> {
  if (!raw) return { value: null };
  return isValidUuid(raw) ? { value: raw } : { error: "El parámetro facturaId debe ser un UUID válido" };
}
