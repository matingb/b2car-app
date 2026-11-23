import { CONDICIONES_IVA_PROVEEDOR, PERCEPCIONES_SUGERIDAS, type PercepcionCodigo } from "./types";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";
import { FISCAL_MONEY_KEYS, type FiscalAmounts, type FiscalMoneyKey } from "@/lib/facturacion/reporteFiscal";
import type {
  ComprasFiscalDocumento,
  ComprasFiscalFilaFactura,
  ComprasFiscalPercepcionColumna,
  ComprasFiscalReport,
  ComprasFiscalFilters,
} from "./reporteFiscal";

const PERCEPCION_LABELS = new Map<string, string>(PERCEPCIONES_SUGERIDAS.map((item) => [item.codigo, item.label]));

function cents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Importe recibido inválido");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error("Importe recibido inválido");
  const result = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Importe recibido fuera del rango numérico seguro");
  return Number(result);
}

function add(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error("Suma de importes recibidos fuera del rango numérico seguro");
  return result;
}

function normalizedLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function compareLabels(a: string, b: string) {
  const left = a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const right = b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizedPercepcionKey(code: PercepcionCodigo | null, descripcion: string) {
  return code && code !== "OTRA"
    ? code
    : `OTRA:${normalizedLabel(descripcion).toLocaleUpperCase("es-AR")}`;
}

function percepcionLabel(key: string, description: string) {
  if (!key.startsWith("OTRA:")) return PERCEPCION_LABELS.get(key) ?? key;
  const label = normalizedLabel(description);
  return label ? label.charAt(0).toLocaleUpperCase("es-AR") + label.slice(1) : key.slice(5);
}

function conditionLabel(value: string | null) {
  return CONDICIONES_IVA_PROVEEDOR.find((condition) => condition.value === value)?.label ?? "Sin informar";
}

function buildInvoiceRow(document: ComprasFiscalDocumento, columns: ComprasFiscalPercepcionColumna[]): ComprasFiscalFilaFactura {
  if (document.tipoDocumento !== "FACTURA" || !document.clase) throw new Error("Factura recibida sin clase válida");
  if (document.lineas.length === 0) throw new Error("Factura recibida sin líneas: no se puede calcular su total documentado");

  let total = 0;
  let totalConceptos = 0;
  const percepciones: Record<string, number> = {};
  for (const line of document.lineas) {
    const amount = cents(line.importe);
    total = add(total, amount);
    if (line.tipo === "CONCEPTO") totalConceptos = add(totalConceptos, amount);
    else {
      const key = normalizedPercepcionKey(line.percepcionCodigo, line.descripcion);
      percepciones[key] = add(percepciones[key] ?? 0, amount);
    }
  }
  const conceptoGasto = document.lineas
    .filter((line) => line.tipo === "CONCEPTO")
    .map((line) => normalizedLabel(line.descripcion))
    .filter(Boolean)
    .join("; ");
  const percepcionIva = percepciones.IVA ?? 0;

  // Solo el desglose confirmado de una factura A alimenta las columnas fiscales. Las tasas
  // operativas y los importes finales de B/C nunca completan datos que el documento no confirmó.
  const breakdown = document.clase === "A" ? document.desgloseIva ?? [] : [];
  const basesByRate = new Map<number, number>();
  const ivaByRate = new Map<number, number>();
  let totalBases = 0;
  let totalIva = 0;
  for (const item of breakdown) {
    if (!ALICUOTAS_IVA_ARCA.some((rate) => rate.id === item.ivaAlicuotaId)) throw new Error("Desglose con alícuota de IVA desconocida");
    const base = cents(item.base);
    const iva = cents(item.iva);
    totalBases = add(totalBases, base);
    totalIva = add(totalIva, iva);
    basesByRate.set(item.ivaAlicuotaId, add(basesByRate.get(item.ivaAlicuotaId) ?? 0, base));
    ivaByRate.set(item.ivaAlicuotaId, add(ivaByRate.get(item.ivaAlicuotaId) ?? 0, iva));
  }
  const desgloseConfirmado = breakdown.length > 0;
  const importeConfirmado = add(totalBases, totalIva);
  if (desgloseConfirmado && importeConfirmado > totalConceptos) {
    throw new Error("El desglose de IVA supera el importe de conceptos de la factura");
  }
  const desgloseCompleto = desgloseConfirmado && importeConfirmado === totalConceptos;

  const amounts: FiscalAmounts = {
    netoGravado: desgloseConfirmado ? totalBases : null,
    sinIvaC: null,
    exento: null,
    noGravado: null,
    base21: desgloseConfirmado
      ? basesByRate.get(5) ?? (desgloseCompleto ? 0 : null)
      : null,
    iva21: desgloseConfirmado
      ? ivaByRate.get(5) ?? (desgloseCompleto ? 0 : null)
      : null,
    baseTotal: desgloseConfirmado ? totalBases : null,
    ivaTotal: desgloseConfirmado ? totalIva : null,
    otrosTributos: null,
    impuestosNacionales: null,
    total,
  };
  const observaciones = [document.observaciones?.trim()]
    .filter((value): value is string => Boolean(value))
    .concat(desgloseConfirmado
      ? desgloseCompleto ? [] : ["Desglose de IVA confirmado parcial"]
      : [document.clase === "A" ? "Sin desglose de IVA confirmado" : `Factura ${document.clase}: solo se informó el importe final`]);
  if (document.clase === "B" && document.ivaContenido != null) {
    observaciones.push(`IVA contenido informado (no discriminado): ${(cents(document.ivaContenido) / 100).toFixed(2)}`);
  }
  if (!document.emisor.razonSocial || !document.emisor.cuit) {
    observaciones.push("Datos del emisor incompletos o no informados");
  }

  return {
    fecha: document.fecha,
    numero: document.numero ?? "",
    tipo: `Factura ${document.clase}`,
    codigoArca: "",
    cae: document.codigoAutorizacion ?? "",
    caeVencimiento: document.vencimientoAutorizacion ?? "",
    cuitEmisor: document.emisor.cuit ?? "",
    receptor: document.receptor.razonSocial ?? "",
    documentoTipo: document.receptor.cuit ? "CUIT" : "",
    documentoNumero: document.receptor.cuit ?? "",
    condicionIva: conditionLabel(document.receptor.condicionIva),
    ...amounts,
    moneda: "ARS",
    origen: document.operacionTipo === "COMPRA" ? "Compra" : "Gasto",
    origenId: document.operacionId,
    asociado: "",
    facturaId: document.id,
    estadoDesglose: document.clase === "C" && !desgloseConfirmado
      ? "NO_APLICA_C"
      : desgloseConfirmado ? desgloseCompleto ? "COMPLETO" : "INCOMPLETO" : "INCOMPLETO",
    observaciones: observaciones.join("; "),
    clase: document.clase,
    documento: "FACTURA",
    razonSocialEmisor: document.emisor.razonSocial,
    documentoId: document.id,
    operacionId: document.operacionId,
    conceptoGasto,
    percepcionIva,
    percepciones: Object.fromEntries(columns.map((column) => [column.key, percepciones[column.key] ?? 0])),
  };
}

function sumField(rows: ComprasFiscalFilaFactura[], key: FiscalMoneyKey) {
  let total = 0;
  let missing = 0;
  for (const row of rows) {
    const amount = row[key];
    if (amount === null) missing += 1;
    else total = add(total, amount);
  }
  return { total: missing > 0 && missing === rows.length ? null : total, missing };
}

export function buildComprasFiscalReport(
  documents: ComprasFiscalDocumento[],
  filters: ComprasFiscalFilters,
): ComprasFiscalReport {
  const seenDocuments = new Set<string>();
  const perceptionLabels = new Map<string, Set<string>>();
  for (const document of documents) {
    if (!document.id || seenDocuments.has(document.id)) throw new Error("Lectura fiscal con documentos duplicados o ausentes");
    seenDocuments.add(document.id);
    if (document.tipoDocumento !== "FACTURA") continue;
    for (const line of document.lineas) {
      if (line.tipo !== "PERCEPCION") continue;
      const key = normalizedPercepcionKey(line.percepcionCodigo, line.descripcion);
      const labels = perceptionLabels.get(key) ?? new Set<string>();
      labels.add(percepcionLabel(key, line.descripcion));
      perceptionLabels.set(key, labels);
    }
  }

  const columnasPercepciones: ComprasFiscalPercepcionColumna[] = [...perceptionLabels.entries()]
    .map(([key, labels]) => {
      const label = [...labels].sort(compareLabels)[0];
      return { key, label, header: `Percepción: ${label}` };
    })
    .sort((a, b) => compareLabels(a.label, b.label) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const invoiceDocuments = documents.filter((document) => document.tipoDocumento === "FACTURA");
  const retentionDocuments = documents.filter((document) => document.tipoDocumento === "RETENCION");
  const rows = invoiceDocuments.map((document) => buildInvoiceRow(document, columnasPercepciones));
  const retenciones = retentionDocuments.flatMap((document) => {
    if (document.lineas.length === 0) throw new Error("Retención recibida sin líneas: no se puede calcular su total documental");
    return document.lineas.map((line) => ({
      fecha: document.fecha,
      numero: document.numero ?? "",
      emisor: document.emisor.razonSocial,
      cuitEmisor: document.emisor.cuit ?? "",
      descripcion: line.descripcion,
      importe: cents(line.importe),
      documentoId: document.id,
      operacionId: document.operacionId,
    }));
  });

  const fiscalAmounts = {} as Record<FiscalMoneyKey, number | null>;
  const missingFiscalAmounts = {} as Record<FiscalMoneyKey, number>;
  for (const key of FISCAL_MONEY_KEYS) {
    const summary = sumField(rows, key);
    fiscalAmounts[key] = summary.total;
    missingFiscalAmounts[key] = summary.missing;
  }
  const totalFacturado = rows.reduce((sum, row) => add(sum, row.total ?? 0), 0);
  const totalRetenciones = retenciones.reduce((sum, row) => add(sum, row.importe), 0);
  const percepciones = Object.fromEntries(columnasPercepciones.map((column) => [
    column.key,
    rows.reduce((sum, row) => add(sum, row.percepciones[column.key] ?? 0), 0),
  ]));
  const totalPercepciones = Object.values(percepciones).reduce(add, 0);

  return {
    filters,
    rows,
    columnasPercepciones,
    retenciones,
    summary: {
      facturas: rows.length,
      totalFacturado,
      retenciones: retentionDocuments.length,
      totalRetenciones,
      totalPercepciones,
      desgloseIncompleto: rows.filter((row) => row.estadoDesglose === "INCOMPLETO").length,
      fiscalAmounts,
      missingFiscalAmounts,
      percepciones,
    },
  };
}
