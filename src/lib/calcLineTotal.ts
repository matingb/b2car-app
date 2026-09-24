import { safeNumber } from "@/lib/numbers";

export type LineaTotalInput = {
  cantidad: number | string;
  horas_facturadas?: number | string | null;
  precio_hora_facturada: number | string;
};

export function calcLineTotal(line: LineaTotalInput): number {
  const price = safeNumber(line.precio_hora_facturada);
  if (line.horas_facturadas === null || line.horas_facturadas === "") {
    return safeNumber(line.cantidad) * price;
  }

  return safeNumber(line.horas_facturadas ?? 1) * price;
}
