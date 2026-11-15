// @vitest-environment node
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildFiscalReport } from "./reporteFiscalCalculos";
import { FISCAL_COLUMNS, FISCAL_LINE_COLUMNS, FISCAL_MONEY_KEYS, fiscalFilename } from "./reporteFiscal";
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
    expect(workbook.worksheets.map(s => s.name)).toEqual(["Resumen", "Comprobantes", "Detalle de conceptos"]);
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
    const summaryConcepts = (summary.getColumn(1).values ?? []).map(String).join("|").toLowerCase();
    expect(summaryConcepts).not.toMatch(/tenant|alcance|moneda|generaci.n|corte|emisor|criterio de sumas/);
    expect(summary.getColumn(1).values).toContain("Nota sobre Detalle de conceptos");
    const linesSheet = workbook.getWorksheet("Detalle de conceptos")!;
    const lineCol = (key: string) => FISCAL_LINE_COLUMNS.findIndex(c => c.key === key) + 1;
    expect(linesSheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(linesSheet.autoFilter).toBe("A1:Q1");
    expect(linesSheet.getCell(2, lineCol("importeTotal")).value).toBe(121);
    expect(linesSheet.getCell(3, lineCol("importeTotal")).value).toBe(-60.5);
    expect(linesSheet.getCell(2, lineCol("fecha")).value).toEqual(new Date("2026-10-31T00:00:00.000Z"));
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
    const summaryConcepts = (summary.getColumn(1).values ?? []).map(String).join("|").toLowerCase();
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

  function comprehensiveLinesSample() {
    const h1 = fiscalTestHeader({
      id: fiscalTestId(101),
      documento_tipo: "FACTURA",
      clase_comprobante: "A",
      tipo_comprobante: 1,
      origen_tipo: "ARREGLO",
      importe_neto_gravado: 450,
      importe_exento: 0,
      importe_no_gravado: 15,
      importe_iva: 94.5,
      importe_tributos: 0,
      otros_impuestos_nacionales: 0,
      total: 559.5,
    });
    const h2 = fiscalTestHeader({
      id: fiscalTestId(102),
      documento_tipo: "FACTURA",
      clase_comprobante: "B",
      tipo_comprobante: 6,
      origen_tipo: "ARREGLO",
      importe_neto_gravado: 100,
      importe_exento: 50,
      importe_no_gravado: 0,
      importe_iva: 21,
      total: 171,
    });
    const h3 = fiscalTestHeader({
      id: fiscalTestId(103),
      documento_tipo: "FACTURA",
      clase_comprobante: "B",
      tipo_comprobante: 6,
      origen_tipo: "VENTA",
      operacion_id: "op-v-1",
      importe_neto_gravado: 505,
      importe_exento: 0,
      importe_no_gravado: 0,
      importe_iva: 106.05,
      total: 611.05,
    });
    const h4 = fiscalTestHeader({
      id: fiscalTestId(104),
      documento_tipo: "FACTURA",
      clase_comprobante: "C",
      tipo_comprobante: 11,
      origen_tipo: "ARREGLO",
      importe_neto_gravado: 300,
      importe_exento: 0,
      importe_no_gravado: 0,
      importe_iva: 0,
      total: 300,
    });
    const h5 = fiscalTestHeader({
      id: fiscalTestId(105),
      documento_tipo: "NOTA_CREDITO",
      clase_comprobante: "A",
      tipo_comprobante: 3,
      origen_tipo: "ARREGLO",
      documento_asociado_id: fiscalTestId(101),
      importe_neto_gravado: 150,
      importe_exento: 0,
      importe_no_gravado: 0,
      importe_iva: 31.5,
      total: 181.5,
    });

    const lines = [
      // H1 lines (Repuesto cat, Repuesto sin cat, Servicio cat, Servicio sin cat, Formulario cat, Insumo NO_GRAVADO)
      fiscalTestLine({ id: fiscalTestId(201), factura_id: h1.id, ordinal: 1, origen: "REPUESTO", codigo: "REP-01", descripcion: "Filtro de Aceite", cantidad: 1, importe_unitario: 121, importe_neto: 100, importe_iva: 21, importe_total: 121, snapshot: { producto: { id: "prod-aceite" } } }),
      fiscalTestLine({ id: fiscalTestId(202), factura_id: h1.id, ordinal: 2, origen: "REPUESTO", codigo: "REP-02", descripcion: "Tornillo especial", cantidad: 2, importe_unitario: 30.25, importe_neto: 50, importe_iva: 10.5, importe_total: 60.5, snapshot: { producto: { id: "prod-sin-cat" } } }),
      fiscalTestLine({ id: fiscalTestId(203), factura_id: h1.id, ordinal: 3, origen: "SERVICIO", source_id: "det-serv-1", descripcion: "Mano de obra frenos", cantidad: 2, importe_unitario: 121, importe_neto: 200, importe_iva: 42, importe_total: 242 }),
      fiscalTestLine({ id: fiscalTestId(204), factura_id: h1.id, ordinal: 4, origen: "SERVICIO", source_id: "det-serv-2", descripcion: "Diagnóstico computarizado", cantidad: 1, importe_unitario: 96.8, importe_neto: 80, importe_iva: 16.8, importe_total: 96.8 }),
      fiscalTestLine({ id: fiscalTestId(205), factura_id: h1.id, ordinal: 5, origen: "FORMULARIO", descripcion: "Formulario de inspección", cantidad: 1, importe_unitario: 24.2, importe_neto: 20, importe_iva: 4.2, importe_total: 24.2, snapshot: { config_id: "form-01" } }),
      fiscalTestLine({ id: fiscalTestId(206), factura_id: h1.id, ordinal: 6, origen: "REPUESTO", descripcion: "Tasa municipal trámite", cantidad: 1, importe_unitario: 15, importe_neto: 15, importe_iva: 0, importe_total: 15, tratamiento_iva: "NO_GRAVADO", iva_alicuota: 0 }),

      // H2 line (Arreglo con Detalle Simplificado expandible)
      fiscalTestLine({
        id: fiscalTestId(207),
        factura_id: h2.id,
        ordinal: 1,
        snapshot: {
          detalleSimplificado: true,
          lineasOriginales: [
            { ordinal: 1, origen: "SERVICIO", sourceId: "det-orig-1", descripcion: "Mano de obra simplificada", cantidad: 1, importeUnitario: 121, tratamientoIva: "GRAVADO", ivaAlicuotaId: 5, ivaAlicuota: 21, importeNeto: 100, importeIva: 21, importeTotal: 121 },
            { ordinal: 2, origen: "REPUESTO", descripcion: "Repuesto exento simplificado", cantidad: 1, importeUnitario: 50, tratamientoIva: "EXENTO", ivaAlicuota: 0, importeNeto: 50, importeIva: 0, importeTotal: 50, snapshot: { producto: { id: "prod-sin-cat" } } },
          ],
        },
      }),

      // H3 lines (Venta directa con cat y sin cat)
      fiscalTestLine({ id: fiscalTestId(208), factura_id: h3.id, ordinal: 1, origen: "VENTA", codigo: "NEU-01", descripcion: "Neumático 205/55 R16", cantidad: 2, importe_unitario: 302.5, importe_neto: 500, importe_iva: 105, importe_total: 605, snapshot: { producto: { id: "prod-cubierta" } } }),
      fiscalTestLine({ id: fiscalTestId(209), factura_id: h3.id, ordinal: 2, origen: "VENTA", codigo: null, descripcion: "Bolsa ecológica", cantidad: 1, importe_unitario: 6.05, importe_neto: 5, importe_iva: 1.05, importe_total: 6.05 }),

      // H4 line (Factura C)
      fiscalTestLine({ id: fiscalTestId(210), factura_id: h4.id, ordinal: 1, origen: "SERVICIO", source_id: "det-serv-c", descripcion: "Servicio de cerrajería", cantidad: 1, importe_unitario: 300, importe_neto: 300, importe_iva: 0, importe_total: 300, tratamiento_iva: "GRAVADO", iva_alicuota_id: null, iva_alicuota: 0 }),

      // H5 lines (NC: Acreditación sobre producto original y Bonificación propia)
      fiscalTestLine({ id: fiscalTestId(211), factura_id: h5.id, ordinal: 1, origen: "AJUSTE", codigo: "REP-01", descripcion: "Devolución Filtro de Aceite", cantidad: 1, importe_unitario: 121, importe_neto: 100, importe_iva: 21, importe_total: 121, snapshot: { lineaOriginal: { producto: { id: "prod-aceite" } } } }),
      fiscalTestLine({ id: fiscalTestId(212), factura_id: h5.id, ordinal: 2, origen: "AJUSTE", codigo: null, descripcion: "Bonificación fidelidad", cantidad: 1, importe_unitario: 60.5, importe_neto: 50, importe_iva: 10.5, importe_total: 60.5, snapshot: { conceptoPropio: true } }),
    ];

    return {
      headers: [h1, h2, h3, h4, h5],
      lines,
      associated: [h1],
      productCategories: new Map([
        ["prod-aceite", ["Lubricantes", "Filtros"]],
        ["prod-cubierta", ["Neumáticos"]],
      ]),
      arregloCategories: new Map([
        ["det-serv-1", "Frenos"],
        ["form-01", "Gestoría"],
        ["det-orig-1", "Service oficial"],
        ["det-serv-c", "Mecánica"],
      ]),
    };
  }

  it("página 1 (Resumen): concilia totales, subtotales por CUIT/clase y auditorías para todos los tipos de comprobantes y líneas", async () => {
    const report = buildFiscalReport(comprehensiveLinesSample(), "tenant-a", { ...fiscalTestFilters, format: "xlsx" }, fiscalTestCorte);
    const workbook = await readXlsx(await serializeFiscalXlsx(report));
    const summary = workbook.getWorksheet("Resumen")!;

    expect(summary.getCell("A1").value).toBe("Concepto");
    expect(summary.getColumn(1).values).toContain("Total del detalle");
    expect(summary.getColumn(1).values).toContain("Nota sobre Detalle de conceptos");
    expect(summary.getColumn(1).values).toContain("Facturas");
    expect(summary.getColumn(1).values).toContain("Notas de crédito");

    // Facturas: H1 (A), H2 (B), H3 (B), H4 (C) = 4 facturas; NC: H5 = 1 nota de crédito
    const facturasRow = Array.from({ length: summary.rowCount }, (_, i) => summary.getRow(i + 1)).find(r => r.getCell(1).value === "Facturas")!;
    expect(facturasRow.getCell(5).value).toBe(4);

    const ncRow = Array.from({ length: summary.rowCount }, (_, i) => summary.getRow(i + 1)).find(r => r.getCell(1).value === "Notas de crédito")!;
    expect(ncRow.getCell(5).value).toBe(1);

    // Total del detalle: suma de H1(559.50) + H2(171.00) + H3(611.05) + H4(300.00) - H5(181.50) = 1460.05
    const totalRow = Array.from({ length: summary.rowCount }, (_, i) => summary.getRow(i + 1)).find(r => r.getCell(1).value === "Total del detalle")!;
    expect(totalRow.getCell(5).value).toBe(5);
    const totalIndex = FISCAL_MONEY_KEYS.indexOf("total");
    expect(totalRow.getCell(6 + totalIndex).value).toBe(1460.05);

    // Subtotales agrupados por CUIT y clase A, B, C
    const subtotales = Array.from({ length: summary.rowCount }, (_, i) => summary.getRow(i + 1)).filter(r => r.getCell(1).value === "Subtotal CUIT / clase");
    expect(subtotales.map(r => r.getCell(4).value)).toEqual(expect.arrayContaining(["A", "B", "C"]));
  });

  it("página 2 (Comprobantes): expone cada comprobante con sus importes netos, IVA, exentos y signos exactos", async () => {
    const report = buildFiscalReport(comprehensiveLinesSample(), "tenant-a", { ...fiscalTestFilters, format: "xlsx" }, fiscalTestCorte);
    const workbook = await readXlsx(await serializeFiscalXlsx(report));
    const sheet = workbook.getWorksheet("Comprobantes")!;
    const col = (key: string) => FISCAL_COLUMNS.findIndex(c => c.key === key) + 1;

    expect(sheet.rowCount).toBe(6); // 1 header + 5 comprobantes
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBe("A1:X1");

    // Fila 2: H1 (Factura A)
    expect(sheet.getCell(2, col("tipo")).value).toBe("Factura A");
    expect(sheet.getCell(2, col("netoGravado")).value).toBe(450);
    expect(sheet.getCell(2, col("noGravado")).value).toBe(15);
    expect(sheet.getCell(2, col("iva21")).value).toBe(94.5);
    expect(sheet.getCell(2, col("total")).value).toBe(559.5);

    // Fila 3: H2 (Factura B simplificada)
    expect(sheet.getCell(3, col("tipo")).value).toBe("Factura B");
    expect(sheet.getCell(3, col("netoGravado")).value).toBe(100);
    expect(sheet.getCell(3, col("exento")).value).toBe(50);
    expect(sheet.getCell(3, col("iva21")).value).toBe(21);
    expect(sheet.getCell(3, col("total")).value).toBe(171);

    // Fila 4: H3 (Factura B Venta directa)
    expect(sheet.getCell(4, col("origen")).value).toBe("VENTA");
    expect(sheet.getCell(4, col("netoGravado")).value).toBe(505);
    expect(sheet.getCell(4, col("iva21")).value).toBe(106.05);
    expect(sheet.getCell(4, col("total")).value).toBe(611.05);

    // Fila 5: H4 (Factura C)
    expect(sheet.getCell(5, col("tipo")).value).toBe("Factura C");
    expect(sheet.getCell(5, col("sinIvaC")).value).toBe(300);
    expect(sheet.getCell(5, col("ivaTotal")).value).toBe(0);
    expect(sheet.getCell(5, col("total")).value).toBe(300);

    // Fila 6: H5 (Nota de Crédito A: importes negativos)
    expect(sheet.getCell(6, col("tipo")).value).toBe("Nota de crédito A");
    expect(sheet.getCell(6, col("netoGravado")).value).toBe(-150);
    expect(sheet.getCell(6, col("iva21")).value).toBe(-31.5);
    expect(sheet.getCell(6, col("total")).value).toBe(-181.5);
  });

  it("página 3 (Detalle de conceptos): desglosa cada tipo distinto de línea con su categoría, tratamiento IVA, cantidad y signos", async () => {
    const report = buildFiscalReport(comprehensiveLinesSample(), "tenant-a", { ...fiscalTestFilters, format: "xlsx" }, fiscalTestCorte);
    const workbook = await readXlsx(await serializeFiscalXlsx(report));
    const linesSheet = workbook.getWorksheet("Detalle de conceptos")!;
    const col = (key: string) => FISCAL_LINE_COLUMNS.findIndex(c => c.key === key) + 1;

    expect(linesSheet.rowCount).toBe(14); // 1 header + 13 líneas
    expect(linesSheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(linesSheet.autoFilter).toBe("A1:Q1");

    // 1. Repuesto con categoría de producto en catálogo
    expect(linesSheet.getCell(2, col("producto")).value).toBe("Filtro de Aceite");
    expect(linesSheet.getCell(2, col("categoria")).value).toBe("Lubricantes, Filtros");
    expect(linesSheet.getCell(2, col("origen")).value).toBe("Arreglo");
    expect(linesSheet.getCell(2, col("tratamientoIva")).value).toBe("Gravado");
    expect(linesSheet.getCell(2, col("alicuotaIva")).value).toBe(21);
    expect(linesSheet.getCell(2, col("cantidad")).value).toBe(1);
    expect(linesSheet.getCell(2, col("precioUnitario")).value).toBe(121);
    expect(linesSheet.getCell(2, col("netoBase")).value).toBe(100);
    expect(linesSheet.getCell(2, col("importeIva")).value).toBe(21);
    expect(linesSheet.getCell(2, col("importeTotal")).value).toBe(121);

    // 2. Repuesto sin categoría en catálogo
    expect(linesSheet.getCell(3, col("producto")).value).toBe("Tornillo especial");
    expect(linesSheet.getCell(3, col("categoria")).value).toBe("");
    expect(linesSheet.getCell(3, col("cantidad")).value).toBe(2);
    expect(linesSheet.getCell(3, col("precioUnitario")).value).toBe(30.25);
    expect(linesSheet.getCell(3, col("importeTotal")).value).toBe(60.5);

    // 3. Servicio con categoría de taller
    expect(linesSheet.getCell(4, col("producto")).value).toBe("Mano de obra frenos");
    expect(linesSheet.getCell(4, col("categoria")).value).toBe("Frenos");
    expect(linesSheet.getCell(4, col("precioUnitario")).value).toBe(121);
    expect(linesSheet.getCell(4, col("importeTotal")).value).toBe(242);

    // 4. Servicio sin categoría de taller
    expect(linesSheet.getCell(5, col("producto")).value).toBe("Diagnóstico computarizado");
    expect(linesSheet.getCell(5, col("categoria")).value).toBe("");
    expect(linesSheet.getCell(5, col("importeTotal")).value).toBe(96.8);

    // 5. Formulario con categoría asociada
    expect(linesSheet.getCell(6, col("producto")).value).toBe("Formulario de inspección");
    expect(linesSheet.getCell(6, col("categoria")).value).toBe("Gestoría");
    expect(linesSheet.getCell(6, col("importeTotal")).value).toBe(24.2);

    // 6. Ítem No gravado
    expect(linesSheet.getCell(7, col("producto")).value).toBe("Tasa municipal trámite");
    expect(linesSheet.getCell(7, col("tratamientoIva")).value).toBe("No gravado");
    expect(linesSheet.getCell(7, col("alicuotaIva")).value).toBeNull();
    expect(linesSheet.getCell(7, col("importeIva")).value).toBe(0);
    expect(linesSheet.getCell(7, col("importeTotal")).value).toBe(15);

    // 7. Línea de Detalle Simplificado expandida: Servicio con categoría
    expect(linesSheet.getCell(8, col("producto")).value).toBe("Mano de obra simplificada");
    expect(linesSheet.getCell(8, col("categoria")).value).toBe("Service oficial");
    expect(linesSheet.getCell(8, col("tratamientoIva")).value).toBe("Gravado");
    expect(linesSheet.getCell(8, col("importeTotal")).value).toBe(121);

    // 8. Línea de Detalle Simplificado expandida: Repuesto Exento
    expect(linesSheet.getCell(9, col("producto")).value).toBe("Repuesto exento simplificado");
    expect(linesSheet.getCell(9, col("tratamientoIva")).value).toBe("Exento");
    expect(linesSheet.getCell(9, col("alicuotaIva")).value).toBeNull();
    expect(linesSheet.getCell(9, col("importeIva")).value).toBe(0);
    expect(linesSheet.getCell(9, col("importeTotal")).value).toBe(50);

    // 9. Venta directa con categoría de producto
    expect(linesSheet.getCell(10, col("producto")).value).toBe("Neumático 205/55 R16");
    expect(linesSheet.getCell(10, col("categoria")).value).toBe("Neumáticos");
    expect(linesSheet.getCell(10, col("origen")).value).toBe("Venta directa");
    expect(linesSheet.getCell(10, col("cantidad")).value).toBe(2);
    expect(linesSheet.getCell(10, col("precioUnitario")).value).toBe(302.5);
    expect(linesSheet.getCell(10, col("importeTotal")).value).toBe(605);

    // 10. Venta directa sin categoría
    expect(linesSheet.getCell(11, col("producto")).value).toBe("Bolsa ecológica");
    expect(linesSheet.getCell(11, col("categoria")).value).toBe("");
    expect(linesSheet.getCell(11, col("origen")).value).toBe("Venta directa");
    expect(linesSheet.getCell(11, col("importeTotal")).value).toBe(6.05);

    // 11. Factura C (Tratamiento Sin IVA (C))
    expect(linesSheet.getCell(12, col("producto")).value).toBe("Servicio de cerrajería");
    expect(linesSheet.getCell(12, col("categoria")).value).toBe("Mecánica");
    expect(linesSheet.getCell(12, col("tratamientoIva")).value).toBe("Sin IVA (C)");
    expect(linesSheet.getCell(12, col("alicuotaIva")).value).toBeNull();
    expect(linesSheet.getCell(12, col("importeIva")).value).toBe(0);
    expect(linesSheet.getCell(12, col("netoBase")).value).toBe(300);
    expect(linesSheet.getCell(12, col("importeTotal")).value).toBe(300);

    // 12. Nota de Crédito: Acreditación de ítem original (signo negativo en importes, unitario positivo)
    expect(linesSheet.getCell(13, col("producto")).value).toBe("Devolución Filtro de Aceite");
    expect(linesSheet.getCell(13, col("categoria")).value).toBe("Lubricantes, Filtros");
    expect(linesSheet.getCell(13, col("cantidad")).value).toBe(1);
    expect(linesSheet.getCell(13, col("precioUnitario")).value).toBe(121); // positivo
    expect(linesSheet.getCell(13, col("netoBase")).value).toBe(-100);     // negativo
    expect(linesSheet.getCell(13, col("importeIva")).value).toBe(-21);      // negativo
    expect(linesSheet.getCell(13, col("importeTotal")).value).toBe(-121);   // negativo

    // 13. Nota de Crédito: Bonificación / concepto propio (signo negativo)
    expect(linesSheet.getCell(14, col("producto")).value).toBe("Bonificación fidelidad");
    expect(linesSheet.getCell(14, col("categoria")).value).toBe("");
    expect(linesSheet.getCell(14, col("precioUnitario")).value).toBe(60.5);
    expect(linesSheet.getCell(14, col("netoBase")).value).toBe(-50);
    expect(linesSheet.getCell(14, col("importeIva")).value).toBe(-10.5);
    expect(linesSheet.getCell(14, col("importeTotal")).value).toBe(-60.5);
  });
});
