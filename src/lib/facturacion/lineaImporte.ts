import type { FacturaLinea } from "./types";

type LineaImporte = Pick<FacturaLinea, "cantidad" | "importeUnitario" | "subtotal" | "importeIva" | "importeTotal" | "snapshot">;

/**
 * Importe que se muestra por línea. Si el arreglo se cargó sin IVA, la línea conserva el neto
 * cargado y el IVA queda acumulado en los totales del comprobante.
 */
export function importeLineaMostrado(line: LineaImporte): number {
  const total = line.importeTotal ?? line.subtotal;
  if (line.snapshot?.preciosIncluyenIva !== false) return total;
  return centsToAmount(amountToCents(total) - amountToCents(line.importeIva ?? 0));
}

/** Precio unitario coherente con el importe mostrado; usa el efectivo si el cargado no extiende al importe. */
export function precioUnitarioMostrado(
  line: Pick<FacturaLinea, "cantidad" | "importeUnitario">,
  importe: number,
): { value: number; maxDecimals: number } {
  const needsEffectivePrice = line.cantidad > 0
    && Math.round(line.importeUnitario * line.cantidad * 100) !== amountToCents(importe);
  return {
    value: needsEffectivePrice ? importe / line.cantidad : line.importeUnitario,
    maxDecimals: needsEffectivePrice ? 6 : 2,
  };
}

function amountToCents(value: number): number {
  return Math.round(value * 100);
}

function centsToAmount(value: number): number {
  return value / 100;
}
