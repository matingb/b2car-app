import { describe, expect, it } from "vitest";
import type { FiscalHeader, FiscalLine, FiscalSource } from "@/app/api/facturas/export/facturasReporteRepository";
import { addFiscalCents, buildFiscalReport, fiscalCents } from "./reporteFiscalCalculos";
import { FISCAL_MONEY_KEYS } from "./reporteFiscal";
import { fiscalTestCorte, fiscalTestFilters, fiscalTestHeader, fiscalTestId, fiscalTestLine } from "./reporteFiscalTestData";

export function testReport(headers: FiscalHeader[] = [fiscalTestHeader()], lines: FiscalLine[] = [fiscalTestLine()], associated: FiscalHeader[] = []) {
  return buildFiscalReport({ headers, lines, associated }, "tenant-a", fiscalTestFilters, fiscalTestCorte);
}

describe("cálculos del reporte fiscal", () => {
  it("convierte decimales exactamente y rechaza precisión perdida y desbordamiento", () => {
    expect(fiscalCents(0.29)).toBe(29);
    expect(fiscalCents("999999999999.99")).toBe(99999999999999);
    expect(fiscalCents("0.01")).toBe(1);
    expect(fiscalCents("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
    for (const v of [null, undefined, "", "1.234", NaN, Infinity, "-1", "1e5"]) expect(fiscalCents(v)).toBeNull();
    expect(() => fiscalCents("90071992547409.92")).toThrow(/seguro/);
    expect(() => addFiscalCents(Number.MAX_SAFE_INTEGER, 1)).toThrow(/seguro/);
  });
  it("acumula 21%, exentos y no gravados desde sus importes históricos", () => {
    const r = testReport([fiscalTestHeader({ importe_neto_gravado: 300, importe_iva: 63, importe_exento: 50, importe_no_gravado: 30, total: 443 })], [
      fiscalTestLine({ importe_neto: 300, importe_iva: 63, importe_total: 363 }),
      fiscalTestLine({ tratamiento_iva: "EXENTO", iva_alicuota_id: null, importe_neto: 50, importe_iva: 0, importe_total: 50 }),
      fiscalTestLine({ tratamiento_iva: "NO_GRAVADO", iva_alicuota_id: null, importe_neto: 30, importe_iva: 0, importe_total: 30 }),
    ]).rows[0];
    expect(r).toMatchObject({ base21: 30000, iva21: 6300, baseTotal: 30000, exento: 5000, noGravado: 3000, total: 44300, estadoDesglose: "COMPLETO" });
  });
  it("expande originales simplificados sin sumar su contenedor", () => {
    const r = testReport([fiscalTestHeader({ importe_exento: 50, total: 171 })], [fiscalTestLine({ importe_neto: 150, importe_iva: 21, importe_total: 171, snapshot: {
      detalleSimplificado: true, lineasOriginales: [
        { tratamientoIva: "GRAVADO", ivaAlicuotaId: 5, ivaAlicuota: 21, importeNeto: 100, importeIva: 21, importeTotal: 121 },
        { tratamientoIva: "EXENTO", importeNeto: 50, importeIva: 0, importeTotal: 50 },
      ],
    } })]).rows[0];
    expect(r).toMatchObject({ base21: 10000, iva21: 2100, exento: 5000, total: 17100, estadoDesglose: "COMPLETO" });
  });
  it.each([null, [], [{}], "inválido"])("no usa contenedor cuando originales son inválidos: %j", originals => {
    const r = testReport(undefined, [fiscalTestLine({ snapshot: { detalleSimplificado: true, lineasOriginales: originals } })]).rows[0];
    expect(r.base21).toBeNull(); expect(r.iva21).toBeNull(); expect(r.estadoDesglose).toBe("INCOMPLETO");
    expect(r.ivaTotal).toBe(2100); expect(r.observaciones).toMatch(/simplificados/);
  });
  it("clase C separa 100 sin IVA, 50 exento y 20 no gravado", () => {
    const r = testReport([fiscalTestHeader({ clase_comprobante: "C", tipo_comprobante: 11, importe_iva: 0, importe_exento: 50, importe_no_gravado: 20, total: 170 })], []).rows[0];
    expect(r).toMatchObject({ sinIvaC: 10000, netoGravado: 0, baseTotal: 0, base21: 0, iva21: 0, ivaTotal: 0, exento: 5000, noGravado: 2000, total: 17000, estadoDesglose: "NO_APLICA_C" });
  });
  it("C histórica conserva IVA incompatible y lo advierte", () => {
    const r = testReport([fiscalTestHeader({ clase_comprobante: "C" })], []).rows[0];
    expect(r.ivaTotal).toBe(2100); expect(r.estadoDesglose).toBe("NO_APLICA_C"); expect(r.observaciones).toMatch(/Inconsistencia clase C/);
  });
  it("cuenta importes desconocidos en C sin confundirlos con no aplicación del IVA", () => {
    const report = testReport([fiscalTestHeader({ clase_comprobante: "C", importe_neto_gravado: null })], []);
    expect(report.rows[0].estadoDesglose).toBe("NO_APLICA_C");
    expect(report.rows[0].sinIvaC).toBeNull(); expect(report.summary.incompletos).toBe(1);
    expect(report.summary.missing.sinIvaC).toBe(1);
  });
  it("NC parcial usa sus propias líneas y referencia de factura anterior, sin agregarla", () => {
    const original = fiscalTestHeader({ id: fiscalTestId(2), fecha_comprobante: "2026-09-15", total: 242 });
    const report = testReport([fiscalTestHeader({ documento_tipo: "NOTA_CREDITO", tipo_comprobante: 3, documento_asociado_id: original.id })], [fiscalTestLine()], [original]);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ netoGravado: -10000, ivaTotal: -2100, base21: -10000, iva21: -2100, total: -12100 });
    expect(report.rows[0].asociado).toBe("Factura A 00005-00000103");
    expect(original.total).toBe(242);
  });
  it("aplica signo a TODOS los importes NC, incluso tributos e informativos", () => {
    const row = testReport([fiscalTestHeader({ documento_tipo: "NOTA_CREDITO", importe_tributos: 15, otros_impuestos_nacionales: 12, total: 136 })]).rows[0];
    for (const key of FISCAL_MONEY_KEYS) expect(row[key]).toBeLessThanOrEqual(0);
    expect(row.otrosTributos).toBe(-1500); expect(row.impuestosNacionales).toBe(-1200);
  });
  it("factura 121 + NC -121 + ND 60,50 concilia exactamente", () => {
    const headers = [fiscalTestHeader(), fiscalTestHeader({ id: fiscalTestId(2), documento_tipo: "NOTA_CREDITO" }),
      fiscalTestHeader({ id: fiscalTestId(3), documento_tipo: "NOTA_DEBITO", importe_neto_gravado: 50, importe_iva: 10.5, total: 60.5 })];
    const report = testReport(headers, headers.map(h => fiscalTestLine({ factura_id: h.id, importe_neto: h.importe_neto_gravado, importe_iva: h.importe_iva, importe_total: h.total })));
    expect(report.summary.amounts.total).toBe(6050);
    expect(report.summary).toMatchObject({ facturas: 1, nc: 1, nd: 1, cantidad: 3 });
  });
  it("usa receptor y emisor snapshot, CF 99/0 y FCE, sin datos actuales", () => {
    const source: FiscalSource = { headers: [fiscalTestHeader({ tipo_comprobante: 201, origen_tipo: "VENTA", operacion_id: "venta-ficticia", receptor_snapshot: {
      nombre: "Receptor alternativo histórico", numeroDocumento: "0", tipoDocumento: 99, condicionIvaReceptorId: 5,
    } })], lines: [fiscalTestLine()], associated: [] };
    const before = JSON.stringify(source);
    const report = buildFiscalReport(source, "tenant-a", fiscalTestFilters, fiscalTestCorte);
    expect(report.rows[0]).toMatchObject({ receptor: "Receptor alternativo histórico", documentoNumero: "0", documentoTipo: "99 - Consumidor final sin identificar", tipo: "Factura A FCE MiPyME", codigoArca: "201", origen: "VENTA", origenId: "venta-ficticia" });
    expect(JSON.stringify(source)).toBe(before);
    expect(report.summary.emisores).toEqual([{ cuit: "20111111112", razonSocial: "Emisor ficticio" }]);
  });
  it("preserva desconocidos y advierte campos/identificadores ausentes", () => {
    const r = testReport([fiscalTestHeader({ importe_iva: null, emisor_snapshot: {}, receptor_snapshot: { tipoDocumento: 123, condicionIvaReceptorId: 123 }, numero_comprobante: null })], []).rows[0];
    expect(r.ivaTotal).toBeNull(); expect(r.base21).toBeNull(); expect(r.baseTotal).toBeNull();
    expect(r.documentoTipo).toBe("123 - Desconocido"); expect(r.condicionIva).toBe("123 - Desconocida");
    expect(r.numero).toBe(""); expect(r.observaciones).toContain("CUIT emisor");
  });
  it("IVA total conocido sin líneas deja indeterminado el 21% y subtotal desconocido", () => {
    const report = testReport(undefined, []);
    expect(report.rows[0]).toMatchObject({ ivaTotal: 2100, base21: null, iva21: null, baseTotal: null, estadoDesglose: "INCOMPLETO" });
    expect(report.summary.amounts.base21).toBeNull(); expect(report.summary.missing.base21).toBe(1);
  });
  it("conserva diferencia de un centavo sin ajustar fuentes", () => {
    const row = testReport(undefined, [fiscalTestLine({ importe_iva: 20.99, importe_total: 120.99 })]).rows[0];
    expect(row).toMatchObject({ iva21: 2099, ivaTotal: 2100, total: 12100, estadoDesglose: "INCOMPLETO" });
    expect(row.observaciones).toContain("IVA 21% (detalle - cabecera): -0.01");
  });
  it("tributos agregados y nacionales informativos no inventan detalle; omite provincia", () => {
    const row = testReport([fiscalTestHeader({ importe_tributos: 15, otros_impuestos_nacionales: 12, total: 136 })]).rows[0];
    expect(row).toMatchObject({ otrosTributos: 1500, impuestosNacionales: 1200, total: 13600 });
    expect(row).not.toHaveProperty("provincia"); expect(row.observaciones).not.toMatch(/provincia/i);
    expect(row.observaciones).toContain("sin detalle"); expect(row.observaciones).not.toContain("Diferencia total");
  });
  it("histórico al 10,5% conserva cabecera sin atribuir al 21%", () => {
    const report = testReport([fiscalTestHeader({ importe_iva: 10.5, total: 110.5 })], [fiscalTestLine({ iva_alicuota_id: 4, iva_alicuota: 10.5, importe_iva: 10.5, importe_total: 110.5 })]);
    expect(report.rows[0]).toMatchObject({ netoGravado: 10000, ivaTotal: 1050, total: 11050, base21: 0, iva21: 0, baseTotal: null, estadoDesglose: "INCOMPLETO" });
    expect(report.rows[0].observaciones).toContain("10.5% (ID 4)"); expect(report.summary.parciales).toBe(1);
  });
  it("mezcla fuera de alcance conserva exclusivamente los conceptos verificables al 21%", () => {
    const row = testReport([fiscalTestHeader({ importe_neto_gravado: 200, importe_iva: 31.5, total: 231.5 })], [fiscalTestLine(), fiscalTestLine({ iva_alicuota_id: 4, iva_alicuota: 10.5, importe_iva: 10.5, importe_total: 110.5 })]).rows[0];
    expect(row).toMatchObject({ base21: 10000, iva21: 2100, baseTotal: null });
  });
  it("no atribuye al 21% una identificación de tasa inconsistente", () => {
    expect(testReport(undefined, [fiscalTestLine({ iva_alicuota: 10.5 })]).rows[0].iva21).toBeNull();
  });
  it("referencia de otro tenant no expone su identidad y fallback temporal queda observado", () => {
    const row = testReport([fiscalTestHeader({ documento_asociado_id: fiscalTestId(2), autorizada_at: null })], undefined,
      [fiscalTestHeader({ id: fiscalTestId(2), tenant_id: "tenant-b", numero_comprobante: 999 })]).rows[0];
    expect(row.asociado).toBe(""); expect(row.observaciones).toContain("no disponible en el tenant"); expect(row.observaciones).toContain("created_at"); expect(row.observaciones).not.toContain("999");
  });
  it("resumen por CUIT/clase suma exactamente detalle y cuenta columnas parciales", () => {
    const headers = [fiscalTestHeader(), fiscalTestHeader({ id: fiscalTestId(2), clase_comprobante: "C", importe_iva: 0, total: 100 }),
      fiscalTestHeader({ id: fiscalTestId(3), emisor_snapshot: { cuit: "20222222223", razonSocial: "Segundo ficticio" } })];
    const report = testReport(headers);
    expect(report.summary.subtotals).toHaveLength(3); expect(report.summary.emisores).toHaveLength(2);
    for (const key of FISCAL_MONEY_KEYS) {
      expect(report.summary.amounts[key]).toBe(report.rows.reduce((sum, row) => sum + (row[key] ?? 0), 0));
    }
    expect(report.summary.missing.base21).toBe(1); expect(report.summary.incompletos).toBe(1);
  });
  it("período vacío produce ceros y ningún emisor inventado", () => {
    const report = testReport([], []);
    expect(report.summary).toMatchObject({ cantidad: 0, facturas: 0, nc: 0, nd: 0, incompletos: 0, emisores: [], subtotals: [] });
    for (const key of FISCAL_MONEY_KEYS) expect(report.summary.amounts[key]).toBe(0);
  });
});
