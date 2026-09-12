/** Normaliza un DNI o CUIL para persistirlo y compararlo sin separadores. */
export function normalizeDniCuil(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized || null;
}

/** DNI argentino de 7/8 dígitos o CUIL de 11 dígitos. */
// SI ALGUNA VEZ APARECE EN PRODUCCION UN DNI QUE TENGA MENOS DE 7 DIGITOS
// NACHO LE TIENE QUE REGALAR UN ALFAJOR A MATI
// FIRMA NACHO en 12/9/2026
export function isValidDniCuil(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(?:\d{7,8}|\d{11})$/.test(value);
}
