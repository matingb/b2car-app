import type { TipoCuentaFinanciera } from "@/model/finanzas";

export const CUENTA_TIPOS: readonly TipoCuentaFinanciera[] = [
  "EFECTIVO",
  "CUENTA_BANCARIA",
  "BILLETERA_DIGITAL",
  "TARJETA_CREDITO",
];

const CUENTA_TIPO_LABELS: Record<TipoCuentaFinanciera, string> = {
  EFECTIVO: "Efectivo",
  CUENTA_BANCARIA: "Cuenta bancaria",
  BILLETERA_DIGITAL: "Billetera digital",
  TARJETA_CREDITO: "Tarjeta de cr\u00e9dito",
};

export function getCuentaTipoLabel(value: string | null | undefined) {
  const tipo = value?.toUpperCase() as TipoCuentaFinanciera | undefined;
  return (tipo && CUENTA_TIPO_LABELS[tipo]) || "Cuenta";
}

export function formatMoney(value: number | null | undefined, moneda = "ARS") {
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda || "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-AR")}`;
  }
}

export function formatFinancialDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toLocalISODate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function normalizeMoneyInput(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
