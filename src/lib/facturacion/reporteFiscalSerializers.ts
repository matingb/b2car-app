import { buildMultiSheetWorkbook, writeWorkbookBuffer } from "@/lib/excel/excelExportBuilder";
import { formatDateTimeLabel } from "@/lib/fechas";
import { FISCAL_COLUMNS, FISCAL_MONEY_KEYS, type FiscalReport, type FiscalSubtotal } from "./reporteFiscal";

/** Exact decimal text, including safe integers near the limit (no toFixed rounding). */
export function fiscalDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Importe fiscal fuera del rango numérico seguro");
  const absolute = BigInt(cents < 0 ? -cents : cents);
  return `${cents < 0 ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
export function protectFiscalText(value: unknown): string {
  const text = String(value ?? "");
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
}
function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function serializeFiscalCsv(report: FiscalReport): string {
  return "\uFEFF" + [
    FISCAL_COLUMNS.map(c => csvCell(c.header)).join(","),
    ...report.rows.map(row => FISCAL_COLUMNS.map(column => {
      const value = row[column.key];
      return csvCell(column.kind === "money" ? value === null ? "" : fiscalDecimal(value as number) : protectFiscalText(value));
    }).join(",")),
  ].join("\r\n") + "\r\n";
}

function subtotalWarning(summary: FiscalSubtotal) {
  const missing = FISCAL_MONEY_KEYS.filter(key => summary.missing[key]).map(key => `${FISCAL_COLUMNS.find(c => c.key === key)!.header}: ${summary.missing[key]} faltante(s)`);
  if (summary.parciales) missing.push(`Desglose parcial: ${summary.parciales} comprobante(s) incompleto(s) o fuera de alcance`);
  return missing.join("; ");
}
function excelMoney(cents: number | null): number | null {
  if (cents === null) return null;
  // Excel stores 15 significant digits. Keep numeric cells without silently dropping cents.
  if (!Number.isSafeInteger(cents) || BigInt(Math.abs(cents)).toString().replace(/0+$/, "").length > 15) {
    throw new Error("Importe fiscal fuera de la precisión numérica de Excel");
  }
  return cents / 100;
}
function subtotalRow(label: string, summary: FiscalSubtotal): Record<string, unknown> {
  return { concepto: label, cuit: summary.cuit, clase: summary.clase, cantidad: summary.cantidad, observaciones: subtotalWarning(summary),
    ...Object.fromEntries(FISCAL_MONEY_KEYS.map(key => [key, excelMoney(summary.amounts[key])])),
  };
}

export function buildFiscalWorkbook(report: FiscalReport) {
  const summary = report.summary;
  const rows: Record<string, unknown>[] = [
    { concepto: "Período inclusivo", detalle: `${report.filters.desde} a ${report.filters.hasta}` },
    { concepto: "Tenant", detalle: report.tenantId },
    { concepto: "Alcance", detalle: `Autorizados · ${report.filters.ambiente === "PRODUCCION" ? "Producción" : "Homologación"} · Facturas / NC / ND (incluye FCE)` },
    { concepto: "Filtros", detalle: `Documento: ${report.filters.documentoTipo ?? "Todos"}; Origen: ${report.filters.origenTipo ?? "Todos"}; CUIT: ${report.filters.cuitEmisor ?? "Todos"}` },
    { concepto: "Moneda", detalle: "PES" },
    { concepto: "Generación / corte", detalle: `${formatDateTimeLabel(report.corte)} (GMT-3); ${report.corte}` },
    ...summary.emisores.map(e => ({ concepto: "Emisor histórico", cuit: e.cuit, detalle: e.razonSocial || "Razón social no informada" })),
    ...(summary.emisores.length ? [] : [{ concepto: "Emisores", detalle: "Sin emisores con comprobantes en este conjunto" }]),
    { concepto: "Facturas", cantidad: summary.facturas }, { concepto: "Notas de crédito", cantidad: summary.nc }, { concepto: "Notas de débito", cantidad: summary.nd },
    { concepto: "Desgloses incompletos", cantidad: summary.incompletos },
    subtotalRow("Total del detalle", summary),
    ...summary.subtotals.map(s => subtotalRow("Subtotal CUIT / clase", s)),
    { concepto: "Criterio de sumas", detalle: "Centavos del detalle. Importes desconocidos vacíos. Subtotales parciales identificados; impuestos nacionales informativos ya contenidos en el total." },
  ];
  const workbook = buildMultiSheetWorkbook<Record<string, unknown>>({ sheets: [
    {
      name: "Resumen", autoFilter: false,
      columns: [
        { key: "concepto", header: "Concepto", width: 28 }, { key: "detalle", header: "Detalle", width: 65 },
        { key: "cuit", header: "CUIT emisor", numFmt: "@" }, { key: "clase", header: "Clase", width: 10 },
        { key: "cantidad", header: "Cantidad", width: 12 },
        ...FISCAL_COLUMNS.filter(c => c.kind === "money").map(c => ({ key: c.key, header: c.header, width: 23, numFmt: "#,##0.00" })),
        { key: "observaciones", header: "Calidad del subtotal", width: 70 },
      ], rows,
    },
    {
      name: "Comprobantes", columns: FISCAL_COLUMNS.map(column => ({
        key: column.key, header: column.header, width: column.key === "observaciones" ? 80 : column.kind === "money" ? 23 : 26,
        numFmt: column.kind === "money" ? "#,##0.00" : column.kind === "date" ? "dd/mm/yyyy" : "@",
        value: row => {
          const value = row[column.key];
          if (column.kind === "money") return excelMoney(value as number | null);
          if (column.kind === "date") return value ? new Date(`${value}T00:00:00.000Z`) : null;
          // ExcelJS string values are literal cells, never formula objects.
          return String(value ?? "");
        },
      })), rows: report.rows,
    },
  ] });
  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).height = 42;
    sheet.getRow(1).eachCell(cell => { cell.alignment = { vertical: "middle", wrapText: true }; });
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      let height = 18;
      row.eachCell((cell, column) => {
        if (typeof cell.value !== "string") return;
        cell.alignment = { vertical: "top", wrapText: true };
        const width = sheet.getColumn(column).width ?? 20;
        const lines = cell.value.split(/\r\n|\r|\n/).reduce((n, part) => n + Math.max(1, Math.ceil(part.length / (width - 2))), 0);
        height = Math.max(height, Math.min(300, lines * 15));
      });
      row.height = height;
    });
  }
  return workbook;
}
export async function serializeFiscalXlsx(report: FiscalReport): Promise<ArrayBuffer> {
  return writeWorkbookBuffer(buildFiscalWorkbook(report));
}

export type FiscalSerializer = (report: FiscalReport) => Promise<{ body: string | ArrayBuffer; mime: string }>;
export const serializeFiscalReport: FiscalSerializer = async report => report.filters.format === "csv"
  ? { body: serializeFiscalCsv(report), mime: "text/csv; charset=utf-8" }
  : { body: await serializeFiscalXlsx(report), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

