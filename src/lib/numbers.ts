export function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function safeInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function hasAtMostDecimalPlaces(value: number, places = 2): boolean {
  if (!Number.isFinite(value) || !Number.isInteger(places) || places < 0) return false;
  const scale = 10 ** places;
  return Math.abs(value * scale - Math.round(value * scale)) <= 1e-7;
}

