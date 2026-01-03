export const APP_LOCALE = "es-AR" as const;

export type FormatNumberArOptions = {
  /**
   * Máximo de decimales a mostrar. Para números no enteros, se mostrará este máximo (redondeando).
   * Para enteros, se mostrará `minDecimals`.
   */
  maxDecimals?: number;
  /** Mínimo de decimales a mostrar (útil para forzar 2 decimales aun cuando sea entero). */
  minDecimals?: number;
};

function clampInt(value: number, min: number, max: number) {
  const n = Math.trunc(value);
  return Math.min(Math.max(n, min), max);
}

/**
 * Formatea un número usando separadores AR: miles con ".", decimales con ",".
 */
export function formatNumberAr(
  value: number,
  options: FormatNumberArOptions = {}
): string {
  if (!Number.isFinite(value)) return "";

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  const safeMax = clampInt(options.maxDecimals ?? 2, 0, 6);
  const safeMin = clampInt(options.minDecimals ?? 0, 0, safeMax);
  const decimalsToUse = Number.isInteger(abs) ? safeMin : safeMax;

  const fixed = abs.toFixed(decimalsToUse);
  const [intPart, fracPart] = fixed.split(".");

  const withThousands = (intPart ?? "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );
  if (!decimalsToUse) return `${sign}${withThousands}`;
  return `${sign}${withThousands},${fracPart ?? ""}`;
}

/**
 * Formatea un monto en pesos argentinos con prefijo "$".
 */
export function formatArs(
  value: number,
  options: FormatNumberArOptions = {}
): string {
  return `$${formatNumberAr(value, options)}`;
}


