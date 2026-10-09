import { PDFDocument, PDFPage } from "pdf-lib";
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
      domicilio: "Los Andes 1840, San Martín, Buenos Aires",
      ingresosBrutos: "EXENTO",
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
  it("pinta explícitamente de blanco el encabezado principal", async () => {
    const drawRectangle = vi.spyOn(PDFPage.prototype, "drawRectangle");

    await generateFiscalInvoicePdf(invoice());

    expect(drawRectangle).toHaveBeenCalledWith(expect.objectContaining({
      x: 38,
      y: 588,
      width: 519.28,
      height: 210,
      color: expect.objectContaining({ red: 1, green: 1, blue: 1 }),
    }));
    drawRectangle.mockRestore();
  });

  it("muestra vencimiento FCE de productos y separa CBU del punto de venta", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const bytes = await generateFiscalInvoicePdf(invoice({
      concepto: 1, tipoComprobante: 201, claseComprobante: "A", fceSistema: "SCA", fceCbu: "1234567890123456789012",
      fechaVencimientoPago: "2026-09-15",
    }));
    expect(Buffer.from(bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const calls = drawText.mock.calls;
    expect(calls.some(([text]) => String(text).includes("Fecha de Vto. para el pago:"))).toBe(true);
    const cbu = calls.find(([text]) => String(text).startsWith("CBU:"));
    const puntoVenta = calls.find(([text]) => String(text).includes("Punto de Venta:"));
    expect(cbu?.[1]?.y).toBeLessThan(puntoVenta?.[1]?.y ?? 0);
    expect(cbu?.[1]?.y).toBeLessThan(646);
    const tableHeader = calls.find(([text]) => text === "CÓDIGO");
    expect(tableHeader?.[1]?.y).toBeLessThan(462);
    drawText.mockRestore();
  });

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

  it("incluye letras y leyenda sólo en FCE C, sin discriminar IVA", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const input = invoice({ tipoComprobante: 211, claseComprobante: "C", fechaComprobante: "2026-10-09", total: 6101500 });
    const before = structuredClone(input);
    const bytes = await generateFiscalInvoicePdf(input);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    const values = drawText.mock.calls.map(([value]) => value);
    expect(values).toContain("PESOS SEIS MILLONES CIENTO UN MIL QUINIENTOS CON 00/100.");
    expect(values.join(" ")).toContain("21 días corridos desde la recepción");
    expect(values).toContain("Subtotal:");
    expect(values).not.toContain("Importe IVA:");
    expect(values).toContain("RESPONSABLE MONOTRIBUTO");
    expect(values).toContain(`CAE N°: ${input.cae}`);
    expect(values).toContain("Fecha de Vto. de CAE: 07/09/2026");
    expect(input).toEqual(before);
    drawText.mockClear();
    await generateFiscalInvoicePdf(invoice());
    const ordinary = drawText.mock.calls.map(([value]) => value).join(" ");
    expect(ordinary).not.toContain("Régimen FCE");
    expect(ordinary).not.toContain("PESOS");
    expect(ordinary).not.toContain("Remitos asociados:");
  });

  it.each([[1, "A"], [6, "B"], [201, "A"], [206, "B"]] as const)("conserva los importes A/B (%s)", async (tipo, clase) => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    await generateFiscalInvoicePdf(invoice({ tipoComprobante: tipo, claseComprobante: clase }));
    const values = drawText.mock.calls.map(([value]) => value);
    expect(values).toContain("Importe Neto:");
    expect(values).toContain("Importe IVA:");
    expect(values).toContain("Otros Tributos:");
  });

  it.each([null, "", "-", " — "])("rechaza una FCE con IIBB ausente (%s)", async (ingresosBrutos) => {
    await expect(generateFiscalInvoicePdf(invoice({ tipoComprobante: 211, emisorSnapshot: { ...invoice().emisorSnapshot, ingresosBrutos } }))).rejects.toThrow("Completá la inscripción o condición");
  });

  it("imprime varios remitos vinculados sin repetirlos", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const first = { clase: "R" as const, puntoEmision: 1, numero: 12 };
    await generateFiscalInvoicePdf(invoice({ tipoComprobante: 211, remitosAsociados: [first, { clase: "X", puntoEmision: 2, numero: 34 }, first] }));
    const values = drawText.mock.calls.map(([value]) => value).join(" ");
    expect(values).toContain("Remitos asociados: R 00001-00000012; X 00002-00000034");
    expect(values.match(/R 00001-00000012/g)).toHaveLength(1);
  });

  it("incluye conceptos exentos y no gravados en el subtotal C y conserva tributos", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    await generateFiscalInvoicePdf(invoice({
      tipoComprobante: 211, claseComprobante: "C", total: 370,
      totales: { netoGravado: 100, noGravado: 200, exento: 50, iva: 0, tributos: 20, otrosImpuestosNacionales: 0, total: 370 },
    }));
    const calls = drawText.mock.calls;
    const subtotalY = calls.find(([value]) => value === "Subtotal:")![1]!.y;
    const tributosY = calls.find(([value]) => value === "Otros Tributos:")![1]!.y;
    expect(calls.some(([value, options]) => value === "$350,00" && options!.y === subtotalY)).toBe(true);
    expect(calls.some(([value, options]) => value === "$20,00" && options!.y === tributosY)).toBe(true);
    expect(calls.some(([value]) => value === "$370,00")).toBe(true);
  });

  it("conserva el QR de una FCE C con los mismos datos autorizados", () => {
    const input = invoice({ tipoComprobante: 211, claseComprobante: "C", total: 6101500.29, fechaComprobante: "2026-10-09", receptorSnapshot: { ...invoice().receptorSnapshot, tipoDocumento: 80, numeroDocumento: "30712345671" } });
    const payload = JSON.parse(Buffer.from(buildArcaQrUrl(input).split("?p=")[1], "base64").toString("utf8"));
    expect(payload).toMatchObject({ ver: 1, fecha: "2026-10-09", tipoCmp: 211, importe: 6101500.29, tipoDocRec: 80, nroDocRec: 30712345671, tipoCodAut: "E", codAut: Number(input.cae) });
  });

  it("pagina FCE largas sin superponer los renglones al pie legal ni salir de la hoja", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    await generateFiscalInvoicePdf(invoice({
      tipoComprobante: 211,
      lineas: Array.from({ length: 25 }, (_, i) => ({ codigo: `R-${i}`, descripcion: "Descripción de prueba extensa ".repeat(i === 24 ? 150 : 4), cantidad: 1, importeUnitario: 1280, subtotal: 1280 })),
      remitosAsociados: Array.from({ length: 60 }, (_, i) => ({ clase: "R", puntoEmision: 1, numero: i + 1 })),
    }));
    const calls = drawText.mock.calls;
    const footerCallIndex = calls.findIndex(([value]) => value === "Subtotal:");
    const finalPage = drawText.mock.contexts[footerCallIndex];
    const footerY = calls[footerCallIndex][1]!.y!;
    const detailCalls = calls.filter(([value], index) => drawText.mock.contexts[index] === finalPage && (value.startsWith("Descripción") || value.startsWith("Remitos asociados:") || value.startsWith("R 00001")));
    detailCalls.forEach(([, options]) => expect(options!.y!).toBeGreaterThan(footerY + 15));
    for (const [value, options] of calls) {
      expect(options!.y!).toBeGreaterThan(20);
      expect(options!.x! + options!.font!.widthOfTextAtSize(value, options!.size!)).toBeLessThanOrEqual(558);
    }
  });
});
