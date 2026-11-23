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

it("exporta sumas parciales y cuenta los comprobantes sin cada dato fiscal", async () => {
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
  const ivaDetail = "Suma parcial. Falta el dato en 1 comprobante";
  const base21Detail = "Suma parcial. Falta el dato en 2 comprobantes";
  const noGravadoDetail = "Falta el dato en 3 comprobantes";

  const csv = serializeComprasFiscalCsv(report);
  expect(csv).toContain(`\r\nIVA,21.00,,${ivaDetail}\r\n`);
  expect(csv).toContain(`\r\nSuma fiscal confirmada: Importe base 21%,0.00,,${base21Detail}\r\n`);
  expect(csv).toContain(`\r\nSuma fiscal confirmada: Importe neto no gravado,,,${noGravadoDetail}\r\n`);

  const workbook = new ExcelJS.Workbook();
  const bytes = await serializeComprasFiscalXlsx(report);
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const summary = new Map<string, [ExcelJS.CellValue, string]>();
  workbook.getWorksheet("Resumen")?.eachRow((row) => {
    summary.set(row.getCell(1).text, [row.getCell(2).value, row.getCell(4).text]);
  });
  expect(summary.get("IVA")).toEqual([21, ivaDetail]);
  expect(summary.get("Suma fiscal confirmada: Importe base 21%")).toEqual([0, base21Detail]);
  expect(summary.get("Suma fiscal confirmada: Importe neto no gravado")).toEqual([null, noGravadoDetail]);
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
      .find((row) => summary!.getCell(row, 1).value === "IVA");
    expect(ivaRow).toBeDefined();
    expect(summary!.getCell(ivaRow!, 2).value).toBe(42);
    const labels = Array.from({ length: summary!.rowCount }, (_, index) => summary!.getCell(index + 1, 1).value)
      .join(" ");
    expect(labels).not.toContain("IVA 21%");
  });
});
