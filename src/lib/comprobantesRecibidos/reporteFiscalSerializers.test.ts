import { expect, it } from "vitest";
import { buildComprasFiscalReport } from "./reporteFiscalCalculos";
import { serializeComprasFiscalCsv } from "./reporteFiscalSerializers";
import type { ComprasFiscalDocumento } from "./reporteFiscal";

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

it("exporta el esquema resumido de compras con IVA confirmado y percepciones", () => {
  const report = buildComprasFiscalReport([invoice], {
    format: "csv",
    desde: "2026-11-01",
    hasta: "2026-11-30",
    tipoOperacion: "COMPRA",
  });
  const rows = serializeComprasFiscalCsv(report).replace(/^\uFEFF/, "").split("\r\n");
  const header = rows[0].split(",");
  const values = rows[1].split(",");
  const fields = Object.fromEntries(header.map((name, index) => [name, values[index]]));

  expect(header.slice(0, 12)).toEqual([
    "Fecha", "Razón Social", "Número", "CUIT", "Tipo Fac", "Neto", "IVA", "No Gravado",
    "Percep. IVA", "Percep. IIBB", "Total", "Concepto Gto",
  ]);
  expect(fields["Razón Social"]).toBe("Proveedor Ejemplo");
  expect(fields["Tipo Fac"]).toBe("Factura A");
  expect(fields.Neto).toBe("58264.46");
  expect(fields.IVA).toBe("12235.54");
  expect(fields["No Gravado"]).toBe("");
  expect(fields["Percep. IVA"]).toBe("500.00");
  expect(fields["Percep. IIBB"]).toBe("1000.00");
  expect(fields.Total).toBe("72000.00");
  expect(fields["Concepto Gto"]).toBe("Repuestos");
  expect(fields["Percep. IIBB Buenos Aires"]).toBe("700.00");
  expect(fields["Percep. IIBB CABA"]).toBe("300.00");
});

it("deja neto e IVA vacíos cuando una factura histórica A no tiene desglose confirmado", () => {
  const invoiceWithoutRate = {
    ...invoice,
    desgloseIva: null,
    lineas: invoice.lineas.map((line) => line.tipo === "CONCEPTO" ? { ...line, ivaAlicuotaId: null } : line),
  };
  const report = buildComprasFiscalReport([invoiceWithoutRate], {
    format: "csv",
    desde: "2026-11-01",
    hasta: "2026-11-30",
    tipoOperacion: "COMPRA",
  });
  const rows = serializeComprasFiscalCsv(report).replace(/^\uFEFF/, "").split("\r\n");
  const header = rows[0].split(",");
  const values = rows[1].split(",");
  const fields = Object.fromEntries(header.map((name, index) => [name, values[index]]));

  expect(fields.Neto).toBe("");
  expect(fields.IVA).toBe("");
  expect(fields.Observaciones).toContain("Sin desglose de IVA confirmado");
});

it("deriva el desglose y el total de una factura A antigua desde sus precios netos y alícuotas", () => {
  const report = buildComprasFiscalReport([{
    ...invoice,
    desgloseIva: null,
    lineas: [invoice.lineas[0]],
  }], {
    format: "csv",
    desde: "2026-11-01",
    hasta: "2026-11-30",
    tipoOperacion: "COMPRA",
  });
  const rows = serializeComprasFiscalCsv(report).replace(/^\uFEFF/, "").split("\r\n");
  const header = rows[0].split(",");
  const values = rows[1].split(",");
  const fields = Object.fromEntries(header.map((name, index) => [name, values[index]]));

  expect(fields.Neto).toBe("70500.00");
  expect(fields.IVA).toBe("14805.00");
  expect(fields.Total).toBe("85305.00");
  expect(fields.Observaciones).not.toContain("Sin desglose de IVA confirmado");
});
