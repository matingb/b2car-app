// @vitest-environment node
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildFiscalReport } from "./reporteFiscalCalculos";
import { FISCAL_COLUMNS, FISCAL_MONEY_KEYS, fiscalFilename } from "./reporteFiscal";
import { buildFiscalWorkbook, fiscalDecimal, protectFiscalText, serializeFiscalCsv, serializeFiscalXlsx } from "./reporteFiscalSerializers";
import { fiscalTestCorte, fiscalTestFilters, fiscalTestHeader, fiscalTestId, fiscalTestLine } from "./reporteFiscalTestData";

async function readCsv(csv: string) {
  const workbook = new ExcelJS.Workbook();
  return workbook.csv.read(Readable.from([csv.replace(/^\uFEFF/, "")]), { map: (value: string) => value });
}
async function readXlsx(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer); return workbook;
}
function sample() {
  const headers = [fiscalTestHeader(),
    fiscalTestHeader({ id: fiscalTestId(2), documento_tipo: "NOTA_CREDITO", importe_neto_gravado: 50, importe_iva: 10.5, total: 60.5, documento_asociado_id: fiscalTestId(1) }),
    fiscalTestHeader({ id: fiscalTestId(3), clase_comprobante: "C", importe_exento: 50, importe_no_gravado: 20, importe_iva: 0, total: 170 }),
    fiscalTestHeader({ id: fiscalTestId(4), importe_iva: 10.5, total: 110.5 }),
    fiscalTestHeader({ id: fiscalTestId(5), importe_exento: 50, importe_no_gravado: 30, total: 201 }),
    fiscalTestHeader({ id: fiscalTestId(6), documento_tipo: "NOTA_DEBITO" }),
    fiscalTestHeader({ id: fiscalTestId(7), tipo_comprobante: 201, origen_tipo: "VENTA", arreglo_id: null, operacion_id: "venta-ficticia", receptor_snapshot: { nombre: '=Receptor "ficticio", con\nsalto', tipoDocumento: 96, numeroDocumento: "00123456", condicionIvaReceptorId: 5 } }),
    fiscalTestHeader({ id: fiscalTestId(8), importe_tributos: 15, otros_impuestos_nacionales: 12, total: 136 }),
    fiscalTestHeader({ id: fiscalTestId(9) }),
    fiscalTestHeader({ id: fiscalTestId(10), importe_neto_gravado: null, receptor_snapshot: {} }),
    fiscalTestHeader({ id: fiscalTestId(11), autorizada_at: null }),
    fiscalTestHeader({ id: fiscalTestId(12), clase_comprobante: "B", tipo_comprobante: 6, emisor_snapshot: { cuit: "20222222223", razonSocial: "Segundo emisor sintético" } }),
  ];
  const lines = [fiscalTestLine(), fiscalTestLine({ factura_id: fiscalTestId(2), importe_neto: 50, importe_iva: 10.5, importe_total: 60.5 }),
    fiscalTestLine({ factura_id: fiscalTestId(4), iva_alicuota_id: 4, iva_alicuota: 10.5, importe_iva: 10.5, importe_total: 110.5 }),
    fiscalTestLine({ factura_id: fiscalTestId(5), snapshot: { lineasOriginales: [
      { tratamientoIva: "GRAVADO", ivaAlicuotaId: 5, ivaAlicuota: 21, importeNeto: 100, importeIva: 21, importeTotal: 121 },
      { tratamientoIva: "EXENTO", importeNeto: 50, importeIva: 0, importeTotal: 50 },
      { tratamientoIva: "NO_GRAVADO", importeNeto: 30, importeIva: 0, importeTotal: 30 },
    ] } }),
    fiscalTestLine({ factura_id: fiscalTestId(7) }), fiscalTestLine({ factura_id: fiscalTestId(8) }),
    fiscalTestLine({ factura_id: fiscalTestId(9), importe_iva: 20.99, importe_total: 120.99 }),
    fiscalTestLine({ factura_id: fiscalTestId(11) }), fiscalTestLine({ factura_id: fiscalTestId(12) }),
  ];
  lines.forEach((line, i) => { line.id = fiscalTestId(10000 + i); });
  return { headers, lines, associated: [headers[0]] };
}

describe("archivos fiscales", () => {
  it("rechaza detalle/resumen que perdería centavos con los 15 dígitos de Excel", async () => {
    const report = buildFiscalReport(sample(), "tenant-a", fiscalTestFilters, fiscalTestCorte);
    report.summary.amounts.total = 2000000000000001;
    await expect(serializeFiscalXlsx(report)).rejects.toThrow(/precisión numérica de Excel/);
    report.summary.amounts.total = 2000000000000000;
    expect(() => buildFiscalWorkbook(report)).not.toThrow();
    report.rows[0].total = Number.MAX_SAFE_INTEGER;
    await expect(serializeFiscalXlsx(report)).rejects.toThrow(/precisión numérica de Excel/);
    expect(serializeFiscalCsv(report)).toContain("90071992547409.91");
  });
  it("CSV protege texto y preserva comas, comillas, CR/LF, ceros y NC numéricas", async () => {
    const dangerous = ' \t=HYPERLINK("x"), nombre\rcon\nsaltos';
    const source = sample(); source.headers[1].receptor_snapshot = { nombre: dangerous, tipoDocumento: 96, numeroDocumento: "00123456", condicionIvaReceptorId: 5 };
    const report = buildFiscalReport(source, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    const csv = serializeFiscalCsv(report), sheet = await readCsv(csv);
    expect(csv.startsWith("\uFEFF")).toBe(true); expect(csv.endsWith("\r\n")).toBe(true);
    const col = (key: string) => FISCAL_COLUMNS.findIndex(c => c.key === key) + 1;
    expect(sheet.getCell(3, col("receptor")).value).toBe(`'${dangerous}`);
    expect(sheet.getCell(3, col("total")).value).toBe("-60.50");
    expect(sheet.getCell(3, col("documentoNumero")).value).toBe("00123456");
    expect(sheet.getCell(2, col("cae")).value).toBe("00001234567890");
    expect(sheet.getCell(7, col("base21")).value).toBe("");
    for (const formula of ["=1+1", "+1", "-texto", "@SUM(A1)", "\t=1", "\r@x", "\n-x", "\uFEFF=1", "\u00a0=1"]) expect(protectFiscalText(formula)).toBe(`'${formula}`);
    expect(fiscalDecimal(Number.MAX_SAFE_INTEGER)).toBe("90071992547409.91");
  });
  it("reabre XLSX con hojas, tipos numéricos/textuales, fechas calendario, filtro y encabezado fijo", async () => {
    const report = buildFiscalReport(sample(), "tenant-a", { ...fiscalTestFilters, format: "xlsx" }, fiscalTestCorte);
    report.rows[0].receptor = "=1+1";
    const workbook = await readXlsx(await serializeFiscalXlsx(report));
    expect(workbook.worksheets.map(s => s.name)).toEqual(["Resumen", "Comprobantes"]);
    const sheet = workbook.getWorksheet("Comprobantes")!;
    const col = (key: string) => FISCAL_COLUMNS.findIndex(c => c.key === key) + 1;
    expect(sheet.getCell(2, col("total")).value).toBe(121);
    expect(sheet.getCell(3, col("total")).value).toBe(-60.5);
    expect(sheet.getCell(2, col("numero")).value).toBe("00005-00000103");
    expect(sheet.getCell(2, col("cae")).value).toBe("00001234567890");
    expect(sheet.getCell(2, col("receptor")).value).toBe("=1+1");
    expect(typeof sheet.getCell(2, col("receptor")).value).toBe("string");
    expect(sheet.getCell(2, col("fecha")).value).toEqual(new Date("2026-10-31T00:00:00.000Z"));
    expect(sheet.getCell(2, col("fecha")).numFmt).toBe("dd/mm/yyyy");
    expect(sheet.getRow(1).height).toBe(42);
    expect(sheet.getCell(1, col("impuestosNacionales")).alignment.wrapText).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBe("A1:X1");
    expect(sheet.getCell(7, col("base21")).value).toBeNull();
    const summary = workbook.getWorksheet("Resumen")!;
    expect(summary.getColumn(1).values).toContain("Notas de crédito");
    expect(summary.getColumn(17).values?.join(" ")).toMatch(/Parcial|parcial/);
    const summaryConcepts = summary.getColumn(1).values.map(String).join("|").toLowerCase();
    expect(summaryConcepts).not.toMatch(/tenant|alcance|moneda|generaci.n|corte|emisor|criterio de sumas/);
    expect(fiscalFilename(report.filters)).toBe("reporte-fiscal-ventas-2026-10-01_2026-10-31.xlsx");
  });
  it("CSV y XLSX expresan el mismo detalle, incluidas excepciones y desconocidos", async () => {
    const report = buildFiscalReport(sample(), "tenant-a", fiscalTestFilters, fiscalTestCorte);
    const csv = await readCsv(serializeFiscalCsv(report));
    const xlsx = (await readXlsx(await serializeFiscalXlsx(report))).getWorksheet("Comprobantes")!;
    expect(csv.rowCount).toBe(report.rows.length + 1); expect(xlsx.rowCount).toBe(csv.rowCount);
    for (let c = 0; c < FISCAL_COLUMNS.length; c++) {
      const column = FISCAL_COLUMNS[c];
      expect(csv.getCell(1, c + 1).value).toBe(column.header); expect(xlsx.getCell(1, c + 1).value).toBe(column.header);
      for (let r = 0; r < report.rows.length; r++) {
        const original = report.rows[r][column.key];
        const csvValue = csv.getCell(r + 2, c + 1).value;
        const excelValue = xlsx.getCell(r + 2, c + 1).value;
        if (column.kind === "money") {
          expect(csvValue).toBe(original === null ? "" : fiscalDecimal(original as number));
          expect(excelValue).toBe(original === null ? null : (original as number) / 100);
        } else if (column.kind === "date") {
          expect(csvValue).toBe(original);
          expect(excelValue).toEqual(original ? new Date(`${original}T00:00:00.000Z`) : null);
        } else {
          expect(csvValue).toBe(protectFiscalText(original)); expect(excelValue).toBe(original);
        }
      }
    }
  });
  it("período vacío conserva las mismas 24 columnas sin provincia ni trazabilidad y resumen cero", async () => {
    const report = buildFiscalReport({ headers: [], lines: [], associated: [] }, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    const csv = await readCsv(serializeFiscalCsv(report));
    const workbook = await readXlsx(await serializeFiscalXlsx(report));
    const sheet = workbook.getWorksheet("Comprobantes")!;
    expect(csv.rowCount).toBe(1); expect(sheet.rowCount).toBe(1);
    expect(sheet.columnCount).toBe(24); expect(sheet.getRow(1).values).toEqual(csv.getRow(1).values);
    expect(serializeFiscalCsv(report)).not.toMatch(/Provincia/);
    const summary = buildFiscalWorkbook(report).getWorksheet("Resumen")!;
    expect(summary.getColumn(1).values).not.toContain("Sin provincia");
    const summaryConcepts = summary.getColumn(1).values.map(String).join("|").toLowerCase();
    expect(summaryConcepts).not.toMatch(/tenant|alcance|moneda|generaci.n|corte|emisor|criterio de sumas/);
    const total = Array.from({ length: summary.rowCount }, (_, i) => summary.getRow(i + 1)).find(r => r.getCell(1).value === "Total del detalle")!;
    expect(total.getCell(5).value).toBe(0);
    for (let i = 0; i < FISCAL_MONEY_KEYS.length; i++) expect(total.getCell(6 + i).value).toBe(0);
  });
  it("genera y reabre más de 1000 filas y concilia cada CUIT/clase", async () => {
    const started = performance.now(), source = sample();
    for (let i = source.headers.length + 1; i <= 1205; i++) {
      const h = fiscalTestHeader({ id: fiscalTestId(i), emisor_snapshot: { cuit: i % 2 ? "20111111112" : "20222222223", razonSocial: "Emisor sintético" } });
      source.headers.push(h); source.lines.push(fiscalTestLine({ id: fiscalTestId(i + 10000), factura_id: h.id }));
    }
    const report = buildFiscalReport(source, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    const buffer = await serializeFiscalXlsx(report), csvText = serializeFiscalCsv(report);
    const workbook = await readXlsx(buffer), csv = await readCsv(csvText);
    const detail = workbook.getWorksheet("Comprobantes")!;
    expect(detail.rowCount).toBe(1206); expect(csv.rowCount).toBe(1206);
    const totalCol = FISCAL_COLUMNS.findIndex(c => c.key === "total") + 1;
    const cents = detail.getColumn(totalCol).values!.slice(2).reduce<number>((sum, value) => sum + Math.round(Number(value) * 100), 0);
    expect(cents).toBe(report.summary.amounts.total);
    for (const group of report.summary.subtotals) {
      const rows = report.rows.filter(r => r.cuitEmisor === group.cuit && r.clase === group.clase);
      for (const key of FISCAL_MONEY_KEYS) {
        const values = rows.filter(r => r[key] !== null);
        expect(group.amounts[key]).toBe(values.length ? values.reduce((s, r) => s + r[key]!, 0) : null);
      }
    }
    if (process.env.FISCAL_ARTIFACT_DIR) {
      await mkdir(process.env.FISCAL_ARTIFACT_DIR, { recursive: true });
      await writeFile(`${process.env.FISCAL_ARTIFACT_DIR}/reporte-fiscal-sintetico.xlsx`, Buffer.from(buffer));
      await writeFile(`${process.env.FISCAL_ARTIFACT_DIR}/reporte-fiscal-sintetico.csv`, csvText);
      await writeFile(`${process.env.FISCAL_ARTIFACT_DIR}/verificacion.json`, JSON.stringify({ filas: report.rows.length, elapsedMs: Math.round(performance.now() - started), bytesXlsx: buffer.byteLength, summary: report.summary }, null, 2));
    }
  }, 30000);
});
