import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildArcaQrPayload,
  buildArcaQrUrl,
  generateFiscalInvoicePdf,
  type FiscalPdfInvoice,
} from "./fiscalPdf";

function invoice(overrides: Partial<FiscalPdfInvoice> = {}): FiscalPdfInvoice {
  return {
    id: "factura-1",
    emisorSnapshot: {
      razonSocial: "B2Car SRL",
      nombreFantasia: "B2CAR",
      cuit: "20442094161",
      domicilio: "Los Andes 1840",
      ingresosBrutos: "-",
      inicioActividades: "2026-08-28",
      condicionIva: "Monotributista",
    },
    receptorSnapshot: {
      nombre: "Pablo Méndez",
      domicilio: "Calle 123",
      tipoDocumento: 96,
      numeroDocumento: "42649117",
      condicionIvaReceptorId: 5,
    },
    concepto: 3,
    fechaComprobante: "2026-08-28",
    fechaServicioDesde: "2026-07-27",
    fechaServicioHasta: "2026-08-28",
    fechaVencimientoPago: "2026-08-28",
    total: 32000,
    puntoVenta: 1,
    tipoComprobante: 11,
    numeroComprobante: 2,
    cae: "86350822627580",
    caeVencimiento: "2026-09-07",
    lineas: [{
      codigo: "SRV-1",
      descripcion: "Mantenimiento de ópticas y luces",
      cantidad: 1,
      importeUnitario: 32000,
      subtotal: 32000,
    }],
    ...overrides,
  };
}

describe("QR fiscal ARCA", () => {
  it("genera el payload oficial con valores numéricos, PES y CAE", () => {
    expect(buildArcaQrPayload(invoice())).toEqual({
      ver: 1,
      fecha: "2026-08-28",
      cuit: 20442094161,
      ptoVta: 1,
      tipoCmp: 11,
      nroCmp: 2,
      importe: 32000,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 96,
      nroDocRec: 42649117,
      tipoCodAut: "E",
      codAut: 86350822627580,
    });
  });

  it("usa Base64 estándar reversible y la URL pública oficial", () => {
    const url = buildArcaQrUrl(invoice());
    const prefix = "https://www.arca.gob.ar/fe/qr/?p=";
    expect(url.startsWith(prefix)).toBe(true);
    const decoded = JSON.parse(Buffer.from(url.slice(prefix.length), "base64").toString("utf8"));
    expect(decoded).toEqual(buildArcaQrPayload(invoice()));
  });
});

describe("PDF fiscal propio", () => {
  it("genera un PDF válido a partir del snapshot", async () => {
    const bytes = await generateFiscalInvoicePdf(invoice());
    expect(Buffer.from(bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it("pagina descripciones largas y tolera un domicilio faltante", async () => {
    const longLines = Array.from({ length: 35 }, (_, index) => ({
      codigo: `REP-${index + 1}`,
      descripcion: `Repuesto ${index + 1} con una descripción suficientemente larga para ocupar más de una línea en el detalle fiscal.`,
      cantidad: 1,
      importeUnitario: 100,
      subtotal: 100,
    }));
    const bytes = await generateFiscalInvoicePdf(invoice({
      receptorSnapshot: { ...invoice().receptorSnapshot, domicilio: null },
      lineas: longLines,
      total: 3500,
    }));
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
