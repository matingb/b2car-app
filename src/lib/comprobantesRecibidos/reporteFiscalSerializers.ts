import { buildMultiSheetWorkbook, writeWorkbookBuffer, type ExcelColumnDef } from "@/lib/excel/excelExportBuilder";
import { FISCAL_COLUMNS, FISCAL_MONEY_KEYS, type FiscalMoneyKey } from "@/lib/facturacion/reporteFiscal";
import { fiscalDecimal, protectFiscalText } from "@/lib/facturacion/reporteFiscalSerializers";
import type { ComprasFiscalFilaFactura, ComprasFiscalReport } from "./reporteFiscal";

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvText(value: unknown) {
  return csvCell(protectFiscalText(value));
}

function csvMoney(value: number | null) {
  return csvCell(value === null ? "" : fiscalDecimal(value));
}

function excelMoney(cents: number | null): number | null {
  if (cents === null) return null;
  if (!Number.isSafeInteger(cents) || BigInt(Math.abs(cents)).toString().replace(/0+$/, "").length > 15) {
    throw new Error("Importe fiscal fuera de la precisión numérica de Excel");
  }
  return cents / 100;
}

type FacturaExportColumn = {
  key: string;
  header: string;
  kind: "date" | "text" | "money";
  width: number;
  value: (row: ComprasFiscalFilaFactura) => string | number | null;
};

function invoiceColumns(report: ComprasFiscalReport): FacturaExportColumn[] {
  const columns: FacturaExportColumn[] = [
    { key: "fecha", header: "Fecha", kind: "date", width: 14, value: (row) => row.fecha },
    { key: "razonSocialEmisor", header: "Razón Social", kind: "text", width: 32, value: (row) => row.razonSocialEmisor },
    { key: "numero", header: "Número", kind: "text", width: 20, value: (row) => row.numero },
    { key: "cuitEmisor", header: "CUIT", kind: "text", width: 16, value: (row) => row.cuitEmisor },
    { key: "tipo", header: "Tipo Fac", kind: "text", width: 14, value: (row) => row.tipo },
    { key: "netoGravado", header: "Neto", kind: "money", width: 18, value: (row) => row.netoGravado },
    { key: "ivaTotal", header: "IVA", kind: "money", width: 16, value: (row) => row.ivaTotal },
    { key: "noGravado", header: "No Gravado", kind: "money", width: 18, value: (row) => row.noGravado },
    { key: "percepcionIva", header: "Percep. IVA", kind: "money", width: 18, value: (row) => row.percepcionIva },
    { key: "percepcionIibb", header: "Percep. IIBB", kind: "money", width: 18, value: (row) => row.percepcionIibb },
    { key: "total", header: "Total", kind: "money", width: 18, value: (row) => row.total },
    { key: "conceptoGasto", header: "Concepto Gto", kind: "text", width: 42, value: (row) => row.conceptoGasto },
  ];

  const fixedPerceptionKeys = new Set(["IVA", "IIBB_BUENOS_AIRES", "IIBB_CABA"]);
  for (const column of report.columnasPercepciones) {
    if (fixedPerceptionKeys.has(column.key)) continue;
    columns.push({
      key: `percepcion_${column.key}`,
      header: column.header,
      kind: "money",
      width: 24,
      value: (row) => row.percepciones[column.key] ?? 0,
    });
  }

  return columns;
}

function invoiceExcelColumns(report: ComprasFiscalReport): ExcelColumnDef<Record<string, unknown>>[] {
  return invoiceColumns(report).map((column) => ({
    key: column.key,
    header: column.header,
    width: column.width,
    numFmt: column.kind === "money" ? "#,##0.00" : column.kind === "date" ? "dd/mm/yyyy" : "@",
    value: (source: Record<string, unknown>) => {
      const value = column.value(source as unknown as ComprasFiscalFilaFactura);
      if (column.kind === "money") return excelMoney(value as number | null);
      if (column.kind === "date") return value ? new Date(`${value}T00:00:00.000Z`) : null;
      return protectFiscalText(value);
    },
  }));
}

type SummaryRow = { concepto: string; importe: number | null; cantidad: number | null; detalle: string };

function fiscalAmountLabel(key: FiscalMoneyKey) {
  if (key === "ivaTotal") return "IVA";
  return FISCAL_COLUMNS.find((column) => column.key === key)?.header ?? key;
}

function summaryRows(report: ComprasFiscalReport): SummaryRow[] {
  const operation = report.filters.tipoOperacion === "COMPRA"
    ? "Compras"
    : report.filters.tipoOperacion === "GASTO" ? "Gastos" : "Compras y gastos";
  const rows: SummaryRow[] = [
    { concepto: "Período inclusivo", importe: null, cantidad: null, detalle: `${report.filters.desde} a ${report.filters.hasta}` },
    { concepto: "Operaciones incluidas", importe: null, cantidad: null, detalle: operation },
    { concepto: "Moneda", importe: null, cantidad: null, detalle: "Pesos argentinos (ARS), sin conversión" },
    { concepto: "Cantidad de facturas", importe: null, cantidad: report.summary.facturas, detalle: "Una fila por factura recibida" },
    { concepto: "Total documentado de facturas", importe: report.summary.totalFacturado, cantidad: null, detalle: "Incluye conceptos y percepciones registradas" },
    { concepto: "Cantidad de facturas con desglose incompleto", importe: null, cantidad: report.summary.desgloseIncompleto, detalle: "Los importes fiscales ausentes no se infieren" },
  ];
  for (const key of FISCAL_MONEY_KEYS) {
    if (key === "total" || key === "iva21") continue;
    const missing = report.summary.missingFiscalAmounts[key];
    rows.push({
      concepto: key === "ivaTotal" ? "IVA" : `Suma fiscal confirmada: ${fiscalAmountLabel(key)}`,
      importe: report.summary.fiscalAmounts[key],
      cantidad: null,
      detalle: missing
        ? `Sin total completo: dato ausente en ${missing} factura(s)`
        : report.summary.desgloseIncompleto
          ? `Suma confirmada parcial; desglose incompleto en ${report.summary.desgloseIncompleto} factura(s)`
          : "Suma del detalle seleccionado",
    });
  }
  for (const column of report.columnasPercepciones) {
    rows.push({ concepto: column.header, importe: report.summary.percepciones[column.key] ?? 0, cantidad: null, detalle: "Suma de importes manuales; ya incluidos en el total de facturas" });
  }
  rows.push(
    { concepto: "Total de percepciones", importe: report.summary.totalPercepciones, cantidad: null, detalle: "Separado del IVA discriminado; ya incluido en las facturas" },
    { concepto: "Cantidad de documentos de retención", importe: null, cantidad: report.summary.retenciones, detalle: "Cada documento se cuenta una sola vez" },
    { concepto: "Total documental de retenciones", importe: report.summary.totalRetenciones, cantidad: null, detalle: "No modifica el total facturado ni los pagos" },
  );
  return rows;
}

export function serializeComprasFiscalCsv(report: ComprasFiscalReport): string {
  const columns = invoiceColumns(report);
  const header = columns.map((column) => csvText(column.header));
  const invoiceRows = report.rows.map((row) => columns.map((column) => {
    const value = column.value(row);
    return column.kind === "money" ? csvMoney(value as number | null) : csvText(value);
  }).join(","));

  const summary = summaryRows(report).map((row) => [
    csvText(row.concepto),
    csvMoney(row.importe),
    row.cantidad === null ? "" : csvText(row.cantidad),
    csvText(row.detalle),
  ].join(","));
  const retentionHeader = ["Fecha", "Número retención", "Emisor", "CUIT emisor", "Detalle", "Importe", "ID documento", "ID operación"].map(csvText).join(",");
  const retentionRows = report.retenciones.map((row) => [
    row.fecha, row.numero, row.emisor, row.cuitEmisor, row.descripcion,
  ].map(csvText).concat([
    csvMoney(row.importe), csvText(row.documentoId), csvText(row.operacionId),
  ]).join(","));

  return "\uFEFF" + [
    header.join(","),
    ...invoiceRows,
    "",
    csvText("Resumen del reporte fiscal de compras"),
    csvText("Concepto") + "," + csvText("Importe") + "," + csvText("Cantidad") + "," + csvText("Detalle"),
    ...summary,
    "",
    csvText("Detalle de retenciones documentales"),
    retentionHeader,
    ...retentionRows,
  ].join("\r\n") + "\r\n";
}

export function buildComprasFiscalWorkbook(report: ComprasFiscalReport) {
  const summary = summaryRows(report).map((row) => ({
    concepto: row.concepto,
    importe: row.importe,
    cantidad: row.cantidad,
    detalle: row.detalle,
  }));
  const retentionColumns: ExcelColumnDef<Record<string, unknown>>[] = [
    { key: "fecha", header: "Fecha", width: 14, numFmt: "dd/mm/yyyy", value: (row: Record<string, unknown>) => new Date(`${row.fecha}T00:00:00.000Z`) },
    { key: "numero", header: "Número retención", width: 24, numFmt: "@" },
    { key: "emisor", header: "Emisor", width: 32, numFmt: "@" },
    { key: "cuitEmisor", header: "CUIT emisor", width: 16, numFmt: "@" },
    { key: "descripcion", header: "Detalle", width: 38, numFmt: "@" },
    { key: "importe", header: "Importe", width: 20, numFmt: "#,##0.00", value: (row: Record<string, unknown>) => excelMoney(row.importe as number) },
    { key: "documentoId", header: "ID documento", width: 38, numFmt: "@" },
    { key: "operacionId", header: "ID operación", width: 38, numFmt: "@" },
  ];
  const summaryData = summary.map((row) => row as unknown as Record<string, unknown>);
  const invoiceData = report.rows.map((row) => row as unknown as Record<string, unknown>);
  const retentionData = report.retenciones.map((row) => row as unknown as Record<string, unknown>);
  return buildMultiSheetWorkbook<Record<string, unknown>>({
    sheets: [
      {
        name: "Resumen",
        autoFilter: false,
        columns: [
          { key: "concepto", header: "Concepto", width: 48 },
          { key: "importe", header: "Importe", width: 22, numFmt: "#,##0.00", value: (row: Record<string, unknown>) => excelMoney(row.importe as number | null) },
          { key: "cantidad", header: "Cantidad", width: 14 },
          { key: "detalle", header: "Detalle", width: 70 },
        ],
        rows: summaryData,
      },
      {
        name: "Facturas",
        columns: invoiceExcelColumns(report),
        rows: invoiceData,
      },
      {
        name: "Retenciones",
        columns: retentionColumns,
        rows: retentionData,
      },
    ],
  });
}

export async function serializeComprasFiscalXlsx(report: ComprasFiscalReport): Promise<ArrayBuffer> {
  return writeWorkbookBuffer(buildComprasFiscalWorkbook(report));
}

export async function serializeComprasFiscalReport(report: ComprasFiscalReport) {
  return report.filters.format === "csv"
    ? { body: serializeComprasFiscalCsv(report), mime: "text/csv; charset=utf-8" }
    : { body: await serializeComprasFiscalXlsx(report), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}
