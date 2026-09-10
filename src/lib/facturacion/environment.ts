import type { FacturacionAmbiente } from "./types";

/**
 * Ambiente de ARCA para nuevas configuraciones, pruebas y emisiones.
 * Solo PRODUCCION habilita el servicio productivo; cualquier otro valor usa
 * homologación para mantener la emisión en el entorno seguro.
 */
export function getFacturacionAmbiente(): FacturacionAmbiente {
  return process.env.ARCA_AMBIENTE === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION";
}
