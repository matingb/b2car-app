import { safeNumber } from "@/lib/numbers";

export type LineaTotalInput = {
  cantidad: number | string;
  horas_facturadas?: number | string | null;
  precio_hora_facturada: number | string;
};

export function calcLineTotal(line: LineaTotalInput): number {
  const quantity = safeNumber(line.cantidad);
  const price = safeNumber(line.precio_hora_facturada);
  if (line.horas_facturadas === null || line.horas_facturadas === "") {
    return quantity * price;
  }

  return safeNumber(line.horas_facturadas ?? 1) * quantity * price;
}
