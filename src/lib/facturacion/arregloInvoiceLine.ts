import { amountToCents, centsToAmount, FacturacionValidationError } from "./arcaPayload";
import type { FacturaLinea } from "./types";

export type ArregloInvoiceServiceInput = {
  sourceId: string;
  descripcion: string;
  cantidad: number;
  horasFacturadas: number | null;
  importeUnitario: number;
  ivaAlicuotaId: number;
  snapshot: Record<string, unknown>;
};

export function createArregloServiceInvoiceLine(
  input: ArregloInvoiceServiceInput,
): Omit<FacturaLinea, "ordinal"> | null {
  const cantidad = input.horasFacturadas === null
    ? input.cantidad
    : input.horasFacturadas;

  // Una línea de mano de obra con cero horas no es facturable. Omitirla antes
  // de la validación genérica permite facturar otros conceptos del arreglo.
  if (cantidad === 0) return null;
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw new FacturacionValidationError("La cantidad de una línea no es válida");
  }

  const importeUnitarioCents = amountToCents(input.importeUnitario);
  const subtotalCents = Math.round(importeUnitarioCents * cantidad);
  if (subtotalCents <= 0) return null;

  return {
    origen: "SERVICIO",
    sourceId: input.sourceId,
    descripcion: input.descripcion,
    cantidad,
    importeUnitario: centsToAmount(importeUnitarioCents),
    subtotal: centsToAmount(subtotalCents),
    ivaAlicuotaId: input.ivaAlicuotaId,
    snapshot: input.snapshot,
  };
}
