import type { FacturacionAmbiente } from "./types";
import { FacturacionValidationError } from "./arcaPayload";

/**
 * Ambiente de ARCA para nuevas configuraciones, pruebas y emisiones.
 * Solo PRODUCCION habilita el servicio productivo; cualquier otro valor usa
 * homologación para mantener la emisión en el entorno seguro.
 */
export function getFacturacionAmbiente(): FacturacionAmbiente {
  return process.env.ARCA_AMBIENTE === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION";
}

export function getFceMipymeMontoMinimo(): number {
  const monto = Number(process.env.FCE_MIPYME_MONTO_MINIMO);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new FacturacionValidationError(
      "Falta configurar FCE_MIPYME_MONTO_MINIMO con un monto positivo",
    );
  }
  return monto;
}

export function reachesFceMipymeLimit(total: number): boolean {
  return total >= getFceMipymeMontoMinimo();
}
