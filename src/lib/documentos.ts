/** Normaliza un DNI o CUIL para persistirlo y compararlo sin separadores. */
export function normalizeDniCuil(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized || null;
}

/** DNI argentino de 7/8 dígitos o CUIL de 11 dígitos. */
export function isValidDniCuil(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(?:\d{7,8}|\d{11})$/.test(value);
}
