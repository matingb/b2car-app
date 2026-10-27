import { formatArs } from "@/lib/format";

export type ClienteSaldoInfo = {
  saldoNeto: number;
  saldoVisible: number;
  tieneDeuda: boolean;
  tieneSaldoAFavor: boolean;
  estaAlDia: boolean;
  formattedMonto: string;
};

/**
 * Resuelve y normaliza el estado financiero de un cliente a partir de su saldo neto.
 * Convención del sistema:
 * - Positivo (> 0): Saldo deudor / pendiente de cobro.
 * - Negativo (< 0): Saldo a favor del cliente.
 * - Cero (= 0): Cuenta al día.
 */
export function resolveClienteSaldo(saldo: number | null | undefined): ClienteSaldoInfo {
  const saldoNeto = typeof saldo === "number" && Number.isFinite(saldo) ? saldo : 0;
  const saldoVisible = Math.abs(saldoNeto);
  const tieneDeuda = saldoNeto > 0;
  const tieneSaldoAFavor = saldoNeto < 0;
  const estaAlDia = saldoNeto === 0;
  const formattedMonto = formatArs(saldoVisible, { maxDecimals: 0, minDecimals: 0 });

  return {
    saldoNeto,
    saldoVisible,
    tieneDeuda,
    tieneSaldoAFavor,
    estaAlDia,
    formattedMonto,
  };
}
