import { amountToCents, FacturacionValidationError } from "./arcaPayload";

const UNITS = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const SPECIAL = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function apocope(value: string): string {
  return value.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
}

function integerInWords(value: number): string {
  if (value === 0) return "CERO";
  if (value < 10) return UNITS[value];
  if (value < 30) return SPECIAL[value - 10];
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` Y ${UNITS[value % 10]}` : ""}`;
  if (value === 100) return "CIEN";
  if (value < 1000) return `${HUNDREDS[Math.floor(value / 100)]}${value % 100 ? ` ${integerInWords(value % 100)}` : ""}`;
  const scale = value >= 1_000_000 ? 1_000_000 : 1000;
  const count = Math.floor(value / scale);
  const prefix = scale === 1000
    ? count === 1 ? "MIL" : `${apocope(integerInWords(count))} MIL`
    : count === 1 ? "UN MILLÓN" : `${apocope(integerInWords(count))} MILLONES`;
  return `${prefix}${value % scale ? ` ${integerInWords(value % scale)}` : ""}`;
}

/** Reuses fiscal cent conversion: never rounds an authorized amount to a different value. */
export function amountInPesosWords(value: number | string): string {
  const cents = amountToCents(value);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 99_999_999_999_999) {
    throw new FacturacionValidationError("El importe en letras debe ser no negativo y estar dentro del rango fiscal");
  }
  return `PESOS ${apocope(integerInWords(Math.floor(cents / 100)))} CON ${String(cents % 100).padStart(2, "0")}/100.`;
}

export function isFceInvoice(tipoComprobante: number): boolean {
  return [201, 206, 211].includes(tipoComprobante);
}

// Historical extensions are summarized in Res. 219/2025's recitals.
// Reviewed on 2026-10-09. Add subsequent regimes here and bump the PDF cache version.
export const FCE_ACCEPTANCE_REGIMES = [
  { desde: "2023-04-01", hasta: "2024-10-31", dias: 21, norma: "Res. 49/2023 y prórrogas hasta Res. 9/2024" },
  { desde: "2024-11-01", hasta: "2025-10-31", dias: 21, norma: "Res. 480/2024" },
  { desde: "2025-11-01", hasta: "2026-10-31", dias: 21, norma: "Res. 219/2025" },
] as const;
const FCE_BASE_ACCEPTANCE_REGIME = { desde: "2026-11-01", hasta: "9999-12-31", dias: 15, norma: "Ley 27.440, art. 5 inc. i), sin prórroga verificada" } as const;

export function fceAcceptanceRegime(fechaEmision: string) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(fechaEmision)
    && !Number.isNaN(Date.parse(fechaEmision))
    && new Date(fechaEmision).toISOString().slice(0, 10) === fechaEmision;
  const regime = validDate && (
    FCE_ACCEPTANCE_REGIMES.find(({ desde, hasta }) => fechaEmision >= desde && fechaEmision <= hasta)
    ?? (fechaEmision >= FCE_BASE_ACCEPTANCE_REGIME.desde ? FCE_BASE_ACCEPTANCE_REGIME : undefined)
  );
  if (!regime) {
    throw new FacturacionValidationError("Debe revisarse el régimen de aceptación FCE para la fecha del comprobante antes de generar el PDF");
  }
  return regime;
}

/** Art. 5(i), Ley 27.440. The reception date is not available; do not invent a deadline. */
export function fceLegalLegend(fechaEmision: string): string {
  const { dias } = fceAcceptanceRegime(fechaEmision);
  return `Esta FCE se tendrá por aceptada tácitamente si, transcurridos ${dias} días corridos desde la recepción en el domicilio fiscal electrónico del comprador o locatario, no consta su rechazo total ni su aceptación expresa en el registro. Sin rechazo total ni cancelación registrada al vencimiento de ese plazo, la FCE constituye título ejecutivo conforme al art. 523 del Código Procesal Civil y Comercial de la Nación y disposiciones concordantes. La aceptación expresa o tácita supone conformidad plena para transferir a terceros la información del documento desde el Registro de Facturas de Crédito Electrónicas MiPyMEs, si el vendedor o locador decide cederlo, transmitirlo o negociarlo. Ley 27.440, art. 5 inc. i).`;
}

const IVA_LABELS: Readonly<Record<number, string>> = {
  1: "IVA RESPONSABLE INSCRIPTO",
  4: "IVA EXENTO",
  5: "CONSUMIDOR FINAL",
  6: "RESPONSABLE MONOTRIBUTO",
  7: "SUJETO NO CATEGORIZADO",
  8: "PROVEEDOR DEL EXTERIOR",
  9: "CLIENTE DEL EXTERIOR",
  10: "IVA LIBERADO - LEY 19.640",
  13: "MONOTRIBUTISTA SOCIAL",
  15: "NO RESPONSABLE IVA",
  16: "MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO",
};

export function receiverFiscalIvaLabel(id: number): string {
  return IVA_LABELS[id] ?? "CONDICIÓN IVA NO INFORMADA";
}

export function emitterFiscalIvaLabel(emitter: Record<string, unknown>): string {
  const value = String(emitter.condicionIvaEmisor ?? emitter.condicionIva ?? "").trim().toUpperCase();
  if (["MONOTRIBUTISTA", "MONOTRIBUTO", "RESPONSABLE MONOTRIBUTO"].includes(value)) return IVA_LABELS[6];
  if (["RESPONSABLE_INSCRIPTO", "RESPONSABLE INSCRIPTO", "IVA RESPONSABLE INSCRIPTO", "IVA RESPONSABLE INSCRITO"].includes(value)) return IVA_LABELS[1];
  return Object.values(IVA_LABELS).find((label) => label === value) ?? (value || "CONDICIÓN IVA NO INFORMADA");
}

export function hasFiscalIibb(value: unknown): boolean {
  return typeof value === "string" && !!value.trim() && !/^[-–—]+$/.test(value.trim());
}

/** Only use supplied data; the current configuration stores the entire address in domicilio. */
export function emitterCommercialAddress(emitter: Record<string, unknown>): string {
  const parts = [emitter.domicilio, emitter.localidad, emitter.provincia]
    .filter((value): value is string => typeof value === "string" && !!value.trim())
    .map((value) => value.trim());
  return parts.filter((part, index) => !parts.slice(0, index).some((previous) => previous.toLocaleLowerCase("es-AR").includes(part.toLocaleLowerCase("es-AR")))).join(", ");
}
