import { safeNumber } from "@/lib/numbers";

export type LineaTotalInput = {
  cantidad: number | string;
  horas_facturadas?: number | string | null;
  precio_hora_facturada: number | string;
};

export function calcLineTotal(line: LineaTotalInput): number {
  return (
    safeNumber(line.cantidad) *
    safeNumber(line.horas_facturadas ?? 1) *
    safeNumber(line.precio_hora_facturada)
  );
}
