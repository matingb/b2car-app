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

/**
 * Convierte una fecha en formato ISO completo (con hora y timezone) al formato yyyy-MM-dd
 * requerido por inputs HTML de tipo date, respetando el timezone local
 * @param dateString - La cadena de fecha en formato ISO (ej: "2025-11-17T00:00:00+00:00")
 * @returns La fecha en formato yyyy-MM-dd (ej: "2025-11-17"), o string vacío si no hay fecha
 */
export const toDateInputFormat = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  // Crear objeto Date desde el string ISO
  const date = new Date(dateString);
  
  // Obtener año, mes y día en el timezone local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};
