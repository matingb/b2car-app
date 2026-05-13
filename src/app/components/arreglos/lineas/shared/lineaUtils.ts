import { formatArs } from "@/lib/format";

export function formatMoney(n: number): string {
  return formatArs(n, { maxDecimals: 0, minDecimals: 0 });
}

export function renderQtyXUnit(cantidad: number, unitario: number): string {
  return `${cantidad} x ${formatMoney(unitario)}`;
}
