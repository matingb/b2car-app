import { safeNumber } from "@/lib/numbers";

export type LineaTotalInput = {
  cantidad: number | string;
  horas_facturadas?: number | string | null;
  precio_hora_facturada: number | string;
  descuento?: number | string | null;
};

export function calcLineSubtotal(line: LineaTotalInput): number {
  const quantity = safeNumber(line.cantidad);
  const price = safeNumber(line.precio_hora_facturada);
  if (line.horas_facturadas === null || line.horas_facturadas === "") {
    return quantity * price;
  }

  return safeNumber(line.horas_facturadas ?? 1) * quantity * price;
}

export function limitarDescuento(descuento: number | string | null | undefined, subtotal: number): number {
  const desc = safeNumber(descuento);
  const max = Math.max(0, subtotal);
  return Math.min(Math.max(0, desc), max);
}

export function calcLineTotal(line: LineaTotalInput): number {
  const subtotal = calcLineSubtotal(line);
  const descuento = safeNumber(line.descuento);
  return Math.max(0, subtotal - descuento);
}
