import { parseCalendarDate } from "@/lib/fechas";
import type { DocumentoFiscalClase, FacturaClase, FacturaOrigenTipo, FacturacionAmbiente } from "./types";

export type FiscalFilters = {
  format: "csv" | "xlsx";
  desde: string;
  hasta: string;
  documentoTipo?: DocumentoFiscalClase;
  origenTipo?: FacturaOrigenTipo;
  cuitEmisor?: string;
};

/** Server-resolved scope; the request cannot choose the billing environment. */
export type FiscalScope = FiscalFilters & { ambiente: FacturacionAmbiente };

export class FiscalQueryError extends Error {}

/** Only an explicit fiscal request is validated here; the general export keeps its contract. */
export function parseFiscalFilters(params: URLSearchParams): FiscalFilters {
  const allowed = new Set(["reporte", "format", "desde", "hasta", "documentoTipo", "origenTipo", "cuitEmisor"]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new FiscalQueryError(`Filtro incompatible con el reporte fiscal: ${key}`);
    if (params.getAll(key).length !== 1) throw new FiscalQueryError(`Filtro repetido: ${key}`);
  }
  if (params.get("reporte") !== "fiscal") throw new FiscalQueryError("Reporte desconocido");
  const format = params.get("format");
  if (format !== "csv" && format !== "xlsx") throw new FiscalQueryError("Formato requerido: csv o xlsx");
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  if (!parseCalendarDate(desde) || !parseCalendarDate(hasta)) throw new FiscalQueryError("Desde y hasta deben ser fechas válidas (AAAA-MM-DD)");
  if (desde > hasta) throw new FiscalQueryError("La fecha desde debe ser anterior o igual a la fecha hasta");
  const documentoTipo = params.get("documentoTipo") || undefined;
  const origenTipo = params.get("origenTipo") || undefined;
  const cuitEmisor = params.get("cuitEmisor") || undefined;
  if (documentoTipo && !["FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"].includes(documentoTipo)) throw new FiscalQueryError("Tipo de documento desconocido");
  if (origenTipo && !["ARREGLO", "VENTA"].includes(origenTipo)) throw new FiscalQueryError("Origen desconocido");
  if (cuitEmisor && !/^\d{11}$/.test(cuitEmisor)) throw new FiscalQueryError("El CUIT emisor debe contener 11 dígitos");
  return { format, desde, hasta, documentoTipo: documentoTipo as DocumentoFiscalClase | undefined, origenTipo: origenTipo as FacturaOrigenTipo | undefined, cuitEmisor };
}

export const FISCAL_MONEY_KEYS = [
  "netoGravado", "sinIvaC", "exento", "noGravado", "base21", "iva21", "baseTotal",
  "ivaTotal", "otrosTributos", "impuestosNacionales", "total",
] as const;
export type FiscalMoneyKey = typeof FISCAL_MONEY_KEYS[number];
/** All money is integer cents. null is unknown, never an inferred zero. */
export type FiscalAmounts = Record<FiscalMoneyKey, number | null>;
export type FiscalRow = FiscalAmounts & {
  fecha: string; numero: string; tipo: string; codigoArca: string; cae: string;
  caeVencimiento: string; cuitEmisor: string; receptor: string; documentoTipo: string;
  documentoNumero: string; condicionIva: string; moneda: string;
  origen: string; origenId: string; asociado: string; facturaId: string;
  estadoDesglose: "COMPLETO" | "NO_APLICA_C" | "INCOMPLETO";
  observaciones: string;
  // Metadata for grouping; deliberately not additional detail columns.
  clase: FacturaClase; documento: DocumentoFiscalClase; razonSocialEmisor: string;
};

export type FiscalColumn = { key: keyof FiscalRow; header: string; kind: "text" | "date" | "money" };
/** Shared ordered contract, including empty files. No dynamic VAT columns. */
export const FISCAL_COLUMNS: readonly FiscalColumn[] = [
  { key: "fecha", header: "Fecha comprobante", kind: "date" },
  { key: "numero", header: "Número", kind: "text" },
  { key: "tipo", header: "Tipo documento", kind: "text" },
  { key: "codigoArca", header: "Código ARCA", kind: "text" },
  { key: "cae", header: "CAE", kind: "text" },
  { key: "caeVencimiento", header: "Vencimiento CAE", kind: "date" },
  { key: "cuitEmisor", header: "CUIT emisor", kind: "text" },
  { key: "receptor", header: "Nombre receptor", kind: "text" },
  { key: "documentoTipo", header: "Tipo documento receptor", kind: "text" },
  { key: "documentoNumero", header: "Documento receptor", kind: "text" },
  { key: "condicionIva", header: "Condición IVA receptor", kind: "text" },
  { key: "netoGravado", header: "Importe neto gravado", kind: "money" },
  { key: "sinIvaC", header: "Importe sin IVA clase C", kind: "money" },
  { key: "exento", header: "Importe exento", kind: "money" },
  { key: "noGravado", header: "Importe neto no gravado", kind: "money" },
  { key: "base21", header: "Importe base 21%", kind: "money" },
  { key: "iva21", header: "Importe IVA 21%", kind: "money" },
  { key: "baseTotal", header: "Importe total base imponible", kind: "money" },
  { key: "ivaTotal", header: "Importe total IVA", kind: "money" },
  { key: "otrosTributos", header: "Importe otros tributos", kind: "money" },
  { key: "impuestosNacionales", header: "Otros impuestos nacionales informados", kind: "money" },
  { key: "total", header: "Importe total", kind: "money" },
  { key: "origen", header: "Origen", kind: "text" },
  { key: "observaciones", header: "Observaciones", kind: "text" },
];

export type FiscalSubtotal = {
  cuit: string; clase: string; cantidad: number;
  amounts: FiscalAmounts; missing: Record<FiscalMoneyKey, number>;
  parciales: number;
};
export type FiscalReport = {
  tenantId: string; filters: FiscalScope; corte: string; rows: FiscalRow[];
  summary: FiscalSubtotal & {
    facturas: number; nc: number; nd: number; incompletos: number;
    emisores: { cuit: string; razonSocial: string }[]; subtotals: FiscalSubtotal[];
  };
};

export function fiscalFilename(filters: FiscalFilters) {
  return `reporte-fiscal-ventas-${filters.desde}_${filters.hasta}.${filters.format}`;
}
