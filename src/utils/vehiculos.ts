/**
 * Formatea una patente de vehículo según su longitud
 * @param patente - La patente sin formato
 * @returns La patente formateada con espacios
 * 
 * @example
 * formatPatente("AB123CD") // "AB 123 CD"
 * formatPatente("ABC123") // "ABC 123"
 */
export function formatPatente(patente: string): string {
  if (!patente) {
    return "";
  }

  const cleanPatente = patente.trim();

  if (cleanPatente.length === 7) {
    return `${cleanPatente.substring(0, 2)} ${cleanPatente.substring(2, 5)} ${cleanPatente.substring(5, 7)}`;
  } else if (cleanPatente.length === 6) {
    return `${cleanPatente.substring(0, 3)} ${cleanPatente.substring(3, 6)}`;
  }

  return cleanPatente;
}

export function formatPatenteConMarcaYModelo(
  v: { patente: string; marca: string; modelo: string }
): string {
  const patente = (v.patente ?? "").trim();
  const marca = (v.marca ?? "").trim();
  const modelo = (v.modelo ?? "").trim();
  const marcaModelo = [marca, modelo].filter(Boolean).join(" ");
  return [patente, marcaModelo].filter(Boolean).join(" - ");
}


