import ExcelJS from "exceljs";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { buildComprasFiscalReport } from "./reporteFiscalCalculos";
import { serializeComprasFiscalCsv, serializeComprasFiscalXlsx } from "./reporteFiscalSerializers";
import type { ComprasFiscalDocumento } from "./reporteFiscal";

const invoiceHeaders = [
  "Fecha",
  "Razón Social",
  "Número",
  "CUIT",
  "Tipo Fac",
  "Total",
  "Neto",
  "IVA",
  "No Gravado",
  "Percep. IVA",
  "Concepto de gasto",
];
const iibbHeaders = ["Percepción: IIBB Buenos Aires", "Percepción: IIBB CABA"];

const invoice: ComprasFiscalDocumento = {
  id: "documento-1",
  operacionId: "operacion-1",
  operacionTipo: "COMPRA",
  tipoDocumento: "FACTURA",
  clase: "A",
  numero: "0003-0000014",
  fecha: "2026-11-18",
  emisor: { razonSocial: "Proveedor Ejemplo", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO" },
  receptor: { razonSocial: null, cuit: null, condicionIva: null },
  codigoAutorizacion: null,
  vencimientoAutorizacion: null,
  observaciones: null,
  desgloseIva: [{ ivaAlicuotaId: 5, base: 58264.46, iva: 12235.54 }],
  lineas: [
    { id: "concepto-1", orden: 1, tipo: "CONCEPTO", descripcion: "Repuestos", percepcionCodigo: null, importe: 70500, ivaAlicuotaId: 5 },
    { id: "percepcion-1", orden: 2, tipo: "PERCEPCION", descripcion: "IVA", percepcionCodigo: "IVA", importe: 500 },
    { id: "percepcion-2", orden: 3, tipo: "PERCEPCION", descripcion: "IIBB Buenos Aires", percepcionCodigo: "IIBB_BUENOS_AIRES", importe: 700 },
    { id: "percepcion-3", orden: 4, tipo: "PERCEPCION", descripcion: "IIBB CABA", percepcionCodigo: "IIBB_CABA", importe: 300 },
  ],
  updatedAt: "2026-11-18T12:00:00.000Z",
};

const filters = { desde: "2026-11-01", hasta: "2026-11-30", tipoOperacion: "COMPRA" as const };

function csvFields(csv: string) {
  const rows = csv.replace(/^\uFEFF/, "").split("\r\n");
  const header = rows[0].split(",");
  const values = rows[1].split(",");
  return { header, fields: Object.fromEntries(header.map((name, index) => [name, values[index]])) };
}

it("exporta el IVA confirmado y separa IIBB por jurisdicción", () => {
  const report = buildComprasFiscalReport([invoice], { ...filters, format: "csv" });
  const { header, fields } = csvFields(serializeComprasFiscalCsv(report));

  expect(header).toEqual([...invoiceHeaders.slice(0, -1), ...iibbHeaders, "Concepto de gasto"]);
  expect(fields["Razón Social"]).toBe("Proveedor Ejemplo");
  expect(fields.Número).toBe("0003-0000014");
  expect(fields.CUIT).toBe("30712345678");
  expect(fields["Tipo Fac"]).toBe("Factura A");
  expect(fields.Neto).toBe("58264.46");
  expect(fields.IVA).toBe("12235.54");
  expect(fields["No Gravado"]).toBe("");
  expect(fields["Percep. IVA"]).toBe("500.00");
  expect(fields["Percepción: IIBB Buenos Aires"]).toBe("700.00");
  expect(fields["Percepción: IIBB CABA"]).toBe("300.00");
  expect(fields.Total).toBe("72000.00");
  expect(fields["Concepto de gasto"]).toBe("Repuestos");
});

it("ubica las percepciones adicionales antes de Concepto de gasto en CSV y XLSX", async () => {
  const invoiceWithExtraPerceptions = {
    ...invoice,
    lineas: [
      ...invoice.lineas,
      { id: "percepcion-ganancias", orden: 5, tipo: "PERCEPCION" as const, descripcion: "Ganancias", percepcionCodigo: "GANANCIAS" as const, importe: 100 },
      { id: "percepcion-iibb-cordoba", orden: 6, tipo: "PERCEPCION" as const, descripcion: "IIBB Córdoba", percepcionCodigo: "OTRA" as const, importe: 200 },
    ],
  };
  const csvReport = buildComprasFiscalReport([invoiceWithExtraPerceptions], { ...filters, format: "csv" });
  const { header, fields } = csvFields(serializeComprasFiscalCsv(csvReport));
  const extraHeaders = ["Percepción: Ganancias", ...iibbHeaders, "Percepción: IIBB Córdoba"];
  const expectedHeaders = [...invoiceHeaders.slice(0, -1), ...extraHeaders, "Concepto de gasto"];

  expect(header).toEqual(expectedHeaders);
  expect(extraHeaders.map((name) => fields[name])).toEqual(["100.00", "700.00", "300.00", "200.00"]);
  expect(fields.Total).toBe("72300.00");
  expect(fields["Concepto de gasto"]).toBe("Repuestos");

  const xlsxReport = buildComprasFiscalReport([invoiceWithExtraPerceptions], { ...filters, format: "xlsx" });
  const bytes = await serializeComprasFiscalXlsx(xlsxReport);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.getWorksheet("Facturas");
  expect(worksheet).toBeDefined();
  const xlsxHeaders = Array.from({ length: worksheet!.columnCount }, (_, index) => worksheet!.getCell(1, index + 1).value);
  expect(xlsxHeaders).toEqual(expectedHeaders);
  expect(worksheet!.getCell("F2").value).toBe(72300);
  expect(extraHeaders.map((name) => worksheet!.getCell(2, xlsxHeaders.indexOf(name) + 1).value))
    .toEqual([100, 700, 300, 200]);
  expect(worksheet!.getCell(2, xlsxHeaders.length).value).toBe("Repuestos");

  const summaryTotals = new Map<string, ExcelJS.CellValue>();
  workbook.getWorksheet("Resumen")?.eachRow((row) => {
    summaryTotals.set(row.getCell(1).text, row.getCell(2).value);
  });
  expect(summaryTotals.get("Percepción: IVA")).toBe(500);
  expect(summaryTotals.get("Percepción: IIBB Buenos Aires")).toBe(700);
  expect(summaryTotals.get("Percepción: IIBB CABA")).toBe(300);
  expect(summaryTotals.get("Percepción: Ganancias")).toBe(100);
  expect(summaryTotals.get("Percepción: IIBB Córdoba")).toBe(200);
});

it("mantiene el total y deja los importes fiscales ausentes cuando una factura A perdió su desglose", () => {
  const invoiceWithoutRate = {
    ...invoice,
    desgloseIva: null,
    lineas: invoice.lineas.filter((line) => line.tipo === "CONCEPTO"),
  };
  const report = buildComprasFiscalReport([invoiceWithoutRate], { ...filters, format: "csv" });
  const { fields } = csvFields(serializeComprasFiscalCsv(report));

  expect(fields.Neto).toBe("");
  expect(fields.IVA).toBe("");
  expect(fields.Total).toBe("70500.00");
  expect(report.summary.missingFiscalAmounts.ivaTotal).toBe(1);
});

it("conserva la factura B por su total final sin inferir base ni IVA discriminado", () => {
  const facturaB = {
    ...invoice,
    clase: "B" as const,
    desgloseIva: null,
    ivaContenido: 21,
    lineas: [{ ...invoice.lineas[0], importe: 121, ivaAlicuotaId: 5 }],
  };
  const report = buildComprasFiscalReport([facturaB], { ...filters, format: "csv" });
  const { fields } = csvFields(serializeComprasFiscalCsv(report));

  expect(fields.Total).toBe("121.00");
  expect(fields.Neto).toBe("");
  expect(fields.IVA).toBe("");
  expect(report.summary.desgloseIncompleto).toBe(1);
});

it("limita el resumen a los totales fiscales acordados", async () => {
  const concepto = { ...invoice.lineas[0], ivaAlicuotaId: 4 };
  const completa: ComprasFiscalDocumento = {
    ...invoice,
    desgloseIva: [{ ivaAlicuotaId: 4, base: 100, iva: 10.5 }],
    lineas: [{ ...concepto, importe: 110.5 }],
  };
  const parcial = { ...completa, id: "documento-2", lineas: [{ ...concepto, importe: 200 }] };
  const sinDesglose: ComprasFiscalDocumento = {
    ...invoice,
    id: "documento-3",
    clase: "B",
    desgloseIva: null,
    lineas: [{ ...concepto, importe: 121 }],
  };
  const report = buildComprasFiscalReport([completa, parcial, sinDesglose], { ...filters, format: "csv" });
  const csv = serializeComprasFiscalCsv(report);
  expect(csv).toContain("\r\nPeríodo inclusivo,,,2026-11-01 a 2026-11-30\r\n");
  expect(csv).toContain("\r\nOperaciones incluidas,,,Compras\r\n");
  expect(csv).toContain("\r\nMoneda,,,\"Pesos argentinos (ARS), sin conversión\"\r\n");
  expect(csv).toContain("\r\nCantidad de facturas,,3,\r\n");
  expect(csv).toContain("\r\nTotal de facturas,431.50,,\r\n");
  expect(csv).toContain("\r\nTotal neto,200.00,,\r\n");
  expect(csv).toContain("\r\nTotal no gravado,,,\r\n");
  expect(csv).toContain("\r\nTotal IVA,21.00,,\r\n");
  expect(csv).not.toContain("Suma fiscal confirmada");
  expect(csv).not.toContain("Cantidad de facturas con desglose incompleto");

  const workbook = new ExcelJS.Workbook();
  const bytes = await serializeComprasFiscalXlsx(report);
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const summary: { concepto: string; importe: ExcelJS.CellValue; cantidad: ExcelJS.CellValue; detalle: string }[] = [];
  workbook.getWorksheet("Resumen")?.eachRow((row) => {
    summary.push({
      concepto: row.getCell(1).text,
      importe: row.getCell(2).value,
      cantidad: row.getCell(3).value,
      detalle: row.getCell(4).text,
    });
  });
  expect(summary.map((row) => row.concepto)).toEqual([
    "Período inclusivo",
    "Operaciones incluidas",
    "Moneda",
    "Cantidad de facturas",
    "Total de facturas",
    "Total neto",
    "Total no gravado",
    "Total IVA",
  ]);
  expect(summary).toMatchObject([
    { concepto: "Período inclusivo", detalle: "2026-11-01 a 2026-11-30" },
    { concepto: "Operaciones incluidas", detalle: "Compras" },
    { concepto: "Moneda", detalle: "Pesos argentinos (ARS), sin conversión" },
    { concepto: "Cantidad de facturas", cantidad: 3 },
    { concepto: "Total de facturas", importe: 431.5 },
    { concepto: "Total neto", importe: 200 },
    { concepto: "Total no gravado", importe: null },
    { concepto: "Total IVA", importe: 21 },
  ]);
});

describe("encabezados del reporte de compras", () => {
  it("mantiene las 11 columnas fijas en CSV cuando no hay documentos", () => {
    const report = buildComprasFiscalReport([], { ...filters, format: "csv" });
    const { header } = csvFields(serializeComprasFiscalCsv(report));
    expect(header).toEqual(invoiceHeaders);
  });

  it("mantiene las 11 columnas fijas en XLSX cuando no hay documentos", async () => {
    const report = buildComprasFiscalReport([], { ...filters, format: "xlsx" });
    const bytes = await serializeComprasFiscalXlsx(report);
    const workbook = new ExcelJS.Workbook();
    const excelBuffer = Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(excelBuffer);
    const worksheet = workbook.getWorksheet("Facturas");
    expect(worksheet).toBeDefined();
    expect(Array.from({ length: invoiceHeaders.length }, (_, index) => worksheet!.getCell(1, index + 1).value)).toEqual(invoiceHeaders);
  });

  it("suma todas las alícuotas en IVA y usa ese total en Resumen", async () => {
    const mixedInvoice: ComprasFiscalDocumento = {
      ...invoice,
      desgloseIva: [
        { ivaAlicuotaId: 5, base: 100, iva: 21 },
        { ivaAlicuotaId: 4, base: 200, iva: 21 },
      ],
      lineas: [
        { id: "concepto-mixto", orden: 1, tipo: "CONCEPTO", descripcion: "Tasas mixtas", percepcionCodigo: null, importe: 342, ivaAlicuotaId: 5 },
        { id: "percepcion-iva-mixta", orden: 2, tipo: "PERCEPCION", descripcion: "IVA", percepcionCodigo: "IVA", importe: 5 },
      ],
    };
    const report = buildComprasFiscalReport([mixedInvoice], { ...filters, format: "xlsx" });
    const bytes = await serializeComprasFiscalXlsx(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.getWorksheet("Facturas");
    expect(worksheet).toBeDefined();
    const headers = Array.from({ length: invoiceHeaders.length }, (_, index) => worksheet!.getCell(1, index + 1).value);
    expect(headers).toEqual(invoiceHeaders);
    expect(worksheet!.getCell(2, headers.indexOf("Neto") + 1).value).toBe(300);
    expect(worksheet!.getCell(2, headers.indexOf("IVA") + 1).value).toBe(42);
    expect(worksheet!.getCell(2, headers.indexOf("Percep. IVA") + 1).value).toBe(5);
    expect(worksheet!.getCell(2, headers.indexOf("Total") + 1).value).toBe(347);

    const summary = workbook.getWorksheet("Resumen");
    expect(summary).toBeDefined();
    const ivaRow = Array.from({ length: summary!.rowCount }, (_, index) => index + 1)
      .find((row) => summary!.getCell(row, 1).value === "Total IVA");
    expect(ivaRow).toBeDefined();
    expect(summary!.getCell(ivaRow!, 2).value).toBe(42);
    const labels = Array.from({ length: summary!.rowCount }, (_, index) => summary!.getCell(index + 1, 1).value)
      .join(" ");
    expect(labels).not.toContain("IVA 21%");
  });
});
