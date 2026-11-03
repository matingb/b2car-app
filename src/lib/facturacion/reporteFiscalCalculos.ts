import type { FiscalHeader, FiscalLine, FiscalSource } from "@/app/api/facturas/export/facturasReporteRepository";
import { parseCalendarDate } from "@/lib/fechas";
import { expandirLineasOriginales } from "./notaCreditoConceptos";
import { CONDICIONES_IVA_RECEPTOR, TIPOS_DOCUMENTO_FISCAL, comprobanteLabel } from "./types";
import { FISCAL_MONEY_KEYS, type FiscalAmounts, type FiscalScope, type FiscalReport, type FiscalRow, type FiscalSubtotal } from "./reporteFiscal";

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Decimal parsing, never floating-point multiplication or rounding of fiscal amounts. */
export function fiscalCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Importe fiscal fuera del rango numérico seguro");
  return Number(cents);
}
export function addFiscalCents(a: number, b: number) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error("Suma fiscal fuera del rango numérico seguro");
  return result;
}

type Concept = {
  ordinal: number; descripcion: string; cantidad: number; subtotal: number;
  tratamientoIva: string; ivaAlicuotaId: number | null; ivaAlicuota: unknown;
  importeNeto: unknown; importeIva: unknown; totalFiscal: unknown;
  snapshot?: Record<string, unknown>;
};
function concept(value: unknown): Concept | null {
  const obj = record(value);
  if (!["GRAVADO", "EXENTO", "NO_GRAVADO"].includes(text(obj.tratamientoIva))) return null;
  if ([obj.importeNeto, obj.importeIva, obj.importeTotal].some(v => fiscalCents(v) === null)) return null;
  if (obj.tratamientoIva === "GRAVADO" && (typeof obj.ivaAlicuotaId !== "number" || fiscalCents(obj.ivaAlicuota) === null)) return null;
  return {
    ordinal: 1, descripcion: "", cantidad: 1, subtotal: 0,
    tratamientoIva: text(obj.tratamientoIva), ivaAlicuotaId: typeof obj.ivaAlicuotaId === "number" ? obj.ivaAlicuotaId : null,
    ivaAlicuota: obj.ivaAlicuota, importeNeto: obj.importeNeto, importeIva: obj.importeIva, totalFiscal: obj.importeTotal,
  };
}

function concepts(lines: FiscalLine[], observations: string[]): Concept[] | null {
  if (!lines.length) { observations.push("Sin líneas fiscales verificables"); return null; }
  const result: Concept[] = [];
  for (const line of lines) {
    const snapshot = record(line.snapshot);
    if ("lineasOriginales" in snapshot || snapshot.detalleSimplificado === true) {
      const originals = snapshot.lineasOriginales;
      if (!Array.isArray(originals) || originals.length === 0) {
        observations.push("Originales simplificados ausentes o inválidos"); return null;
      }
      const parsed = originals.map(concept);
      if (parsed.some(c => !c)) { observations.push("Originales simplificados con datos fiscales inválidos"); return null; }
      // Expand only after validation; the presentation container never enters the sum.
      result.push(...expandirLineasOriginales<Concept>([{ ...parsed[0]!, snapshot: { lineasOriginales: parsed } }]));
    } else {
      const parsed = concept({ tratamientoIva: line.tratamiento_iva, ivaAlicuotaId: line.iva_alicuota_id,
        ivaAlicuota: line.iva_alicuota, importeNeto: line.importe_neto, importeIva: line.importe_iva, importeTotal: line.importe_total });
      if (!parsed) { observations.push("Línea con datos fiscales faltantes o inválidos"); return null; }
      result.push(parsed);
    }
  }
  return result;
}

function numberLabel(h: FiscalHeader) {
  return h.punto_venta != null && h.numero_comprobante != null
    ? `${String(h.punto_venta).padStart(5, "0")}-${String(h.numero_comprobante).padStart(8, "0")}` : "";
}
function typeLabel(h: FiscalHeader) {
  return `${comprobanteLabel(h.documento_tipo, h.clase_comprobante)}${[201, 206, 211].includes(h.tipo_comprobante) ? " FCE MiPyME" : ""}`;
}

function fiscalRow(header: FiscalHeader, lines: FiscalLine[], associated: Map<string, FiscalHeader>): FiscalRow {
  const obs: string[] = [];
  let incomplete = false;
  const amount = (value: unknown, label: string) => {
    const parsed = fiscalCents(value);
    if (parsed === null) { incomplete = true; obs.push(`Importe faltante o inválido: ${label}`); }
    return parsed;
  };
  const isC = header.clase_comprobante === "C";
  const net = amount(header.importe_neto_gravado, "neto");
  const amounts: FiscalAmounts = {
    netoGravado: isC ? 0 : net, sinIvaC: isC ? net : 0,
    exento: amount(header.importe_exento, "exento"), noGravado: amount(header.importe_no_gravado, "no gravado"),
    base21: isC ? 0 : null, iva21: isC ? 0 : null, baseTotal: isC ? 0 : null,
    ivaTotal: amount(header.importe_iva, "IVA total"), otrosTributos: amount(header.importe_tributos, "otros tributos"),
    impuestosNacionales: amount(header.otros_impuestos_nacionales, "impuestos nacionales informados"), total: amount(header.total, "total"),
  };
  const compare = (detail: number | null, head: number | null, label: string) => {
    if (detail !== null && head !== null && detail !== head) {
      incomplete = true;
      obs.push(`Diferencia ${label} (detalle - cabecera): ${((detail - head) / 100).toFixed(2)}`);
    }
  };
  if (isC) {
    if (amounts.ivaTotal) obs.push("Inconsistencia clase C: IVA total guardado distinto de cero");
  } else {
    const detail = concepts(lines, obs);
    if (!detail) incomplete = true;
    else {
      let base21 = 0, iva21 = 0, exento = 0, noGravado = 0;
      let outside = false, invalid = false;
      for (const line of detail) {
        const neto = fiscalCents(line.importeNeto)!;
        const iva = fiscalCents(line.importeIva)!;
        const total = fiscalCents(line.totalFiscal)!;
        compare(addFiscalCents(neto, iva), total, "total de línea");
        if (line.tratamientoIva === "GRAVADO") {
          if (line.ivaAlicuotaId === 5 && fiscalCents(line.ivaAlicuota) === 2100) {
            base21 = addFiscalCents(base21, neto); iva21 = addFiscalCents(iva21, iva);
          } else if (line.ivaAlicuotaId === 5 || fiscalCents(line.ivaAlicuota) === 2100) {
            invalid = true; obs.push("Identificación de alícuota 21% inconsistente");
          } else {
            outside = true;
            obs.push(`Alícuota fuera del alcance del desglose: ${text(line.ivaAlicuota)}% (ID ${line.ivaAlicuotaId})`);
          }
        } else {
          if (iva !== 0) { invalid = true; obs.push("IVA incompatible con concepto exento/no gravado"); }
          if (line.tratamientoIva === "EXENTO") exento = addFiscalCents(exento, neto);
          else noGravado = addFiscalCents(noGravado, neto);
        }
      }
      amounts.base21 = invalid ? null : base21;
      amounts.iva21 = invalid ? null : iva21;
      amounts.baseTotal = invalid || outside ? null : base21;
      if (outside || invalid) incomplete = true;
      if (!outside && !invalid) {
        compare(base21, net, "neto 21%"); compare(iva21, amounts.ivaTotal, "IVA 21%");
      }
      compare(exento, amounts.exento, "exento"); compare(noGravado, amounts.noGravado, "no gravado");
    }
  }
  const components = [net, amounts.exento, amounts.noGravado, amounts.ivaTotal, amounts.otrosTributos];
  if (components.every((v): v is number => v !== null)) compare(components.reduce(addFiscalCents, 0), amounts.total, "total de cabecera");
  if (amounts.otrosTributos) obs.push("Otros tributos agregados sin detalle de categorías/jurisdicción");
  const emisor = record(header.emisor_snapshot), receptor = record(header.receptor_snapshot);
  const requiredText = (value: unknown, label: string) => {
    const result = text(value);
    if (!result) obs.push(`Dato histórico faltante: ${label}`);
    return result;
  };
  const documentCode = text(receptor.tipoDocumento), conditionCode = text(receptor.condicionIvaReceptorId);
  const documentLabel = TIPOS_DOCUMENTO_FISCAL.find(d => String(d.id) === documentCode)?.label;
  const conditionLabel = CONDICIONES_IVA_RECEPTOR.find(d => String(d.id) === conditionCode)?.label;
  if (!documentLabel) obs.push("Tipo documento receptor desconocido o ausente");
  if (!conditionLabel) obs.push("Condición IVA receptor desconocida o ausente");
  let asociado = "";
  if (header.documento_asociado_id) {
    const original = associated.get(header.documento_asociado_id);
    if (original && original.tenant_id === header.tenant_id) {
      asociado = `${typeLabel(original)} ${numberLabel(original)}`.trim();
      if (!numberLabel(original)) obs.push("Número del comprobante asociado ausente");
    } else obs.push("Comprobante asociado no disponible en el tenant");
  } else if (header.documento_tipo !== "FACTURA") obs.push("Referencia de comprobante asociado ausente");
  if (!header.autorizada_at) obs.push("Sin fecha de autorización: corte temporal por created_at; fecha de autorización desconocida");
  const sign = header.documento_tipo === "NOTA_CREDITO" ? -1 : 1;
  for (const key of FISCAL_MONEY_KEYS) {
    if (amounts[key] !== null) amounts[key] = amounts[key] === 0 ? 0 : sign * amounts[key]!;
  }
  const date = (value: string | null, label: string) => {
    if (value && parseCalendarDate(value)) return value;
    obs.push(`Fecha histórica faltante o inválida: ${label}`); return "";
  };
  // Evaluate diagnostics before joining observations (argument/property evaluation order matters).
  const identity = {
    fecha: date(header.fecha_comprobante, "comprobante"), numero: requiredText(numberLabel(header), "número"),
    tipo: typeLabel(header), codigoArca: String(header.tipo_comprobante), cae: requiredText(header.cae, "CAE"),
    caeVencimiento: date(header.cae_vencimiento, "vencimiento CAE"),
    cuitEmisor: requiredText(emisor.cuit, "CUIT emisor"), receptor: requiredText(receptor.nombre, "nombre receptor"),
    documentoTipo: documentCode ? `${documentCode} - ${documentLabel ?? "Desconocido"}` : "",
    documentoNumero: requiredText(receptor.numeroDocumento, "documento receptor"),
    condicionIva: conditionCode ? `${conditionCode} - ${conditionLabel ?? "Desconocida"}` : "",
    moneda: requiredText(header.moneda, "moneda"),
    origen: header.origen_tipo, origenId: requiredText(header.origen_tipo === "ARREGLO" ? header.arreglo_id : header.operacion_id, "origen"),
    asociado, facturaId: header.id, clase: header.clase_comprobante, documento: header.documento_tipo,
    razonSocialEmisor: requiredText(emisor.razonSocial, "razón social emisor"),
  };
  return { ...amounts, ...identity, estadoDesglose: isC ? "NO_APLICA_C" : incomplete ? "INCOMPLETO" : "COMPLETO", observaciones: [...new Set(obs)].join("; ") };
}

function incompleteFiscalData(row: FiscalRow) {
  return row.estadoDesglose === "INCOMPLETO" || FISCAL_MONEY_KEYS.some(key => row[key] === null);
}
function subtotal(rows: FiscalRow[], cuit = "Todos", clase = "Todas"): FiscalSubtotal {
  const amounts = {} as FiscalAmounts, missing = {} as FiscalSubtotal["missing"];
  for (const key of FISCAL_MONEY_KEYS) {
    const values = rows.map(r => r[key]).filter((v): v is number => v !== null);
    missing[key] = rows.length - values.length;
    amounts[key] = rows.length && !values.length ? null : values.reduce(addFiscalCents, 0);
  }
  return { cuit, clase, cantidad: rows.length, amounts, missing, parciales: rows.filter(incompleteFiscalData).length };
}

export function buildFiscalReport(source: FiscalSource, tenantId: string, filters: FiscalScope, corte: string): FiscalReport {
  const lines = new Map<string, FiscalLine[]>();
  for (const line of source.lines) { const group = lines.get(line.factura_id) ?? []; group.push(line); lines.set(line.factura_id, group); }
  const associated = new Map(source.associated.map(h => [h.id, h]));
  const rows = source.headers.map(h => fiscalRow(h, lines.get(h.id) ?? [], associated));
  const groups = new Map<string, FiscalRow[]>();
  const emisores = new Map<string, { cuit: string; razonSocial: string }>();
  for (const row of rows) {
    const key = JSON.stringify([row.cuitEmisor, row.clase]);
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
    emisores.set(JSON.stringify([row.cuitEmisor, row.razonSocialEmisor]), { cuit: row.cuitEmisor, razonSocial: row.razonSocialEmisor });
  }
  return {
    tenantId, filters, corte, rows,
    summary: { ...subtotal(rows), facturas: rows.filter(r => r.documento === "FACTURA").length,
      nc: rows.filter(r => r.documento === "NOTA_CREDITO").length, nd: rows.filter(r => r.documento === "NOTA_DEBITO").length,
      incompletos: rows.filter(incompleteFiscalData).length,
      emisores: [...emisores.values()], subtotals: [...groups.values()].map(group => subtotal(group, group[0].cuitEmisor, group[0].clase)),
    },
  };
}
