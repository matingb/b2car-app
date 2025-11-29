/**
 * Valida si una cadena de texto representa una fecha válida en formato ISO (YYYY-MM-DD)
 * @param dateString - La cadena a validar
 * @returns true si es una fecha válida, false en caso contrario
 */
export const isValidDate = (dateString: string): boolean => {
  if (!dateString || dateString.trim().length === 0) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
};

