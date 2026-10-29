import { PDFDocument, PDFPage } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildArcaQrPayload,
  buildArcaQrUrl,
  fiscalPdfUnitPrice,
  generateFiscalInvoiceHtml,
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

describe("precio unitario fiscal con redondeo comercial", () => {
  it("usa unitario bruto con precisión suficiente cuando el total extendido redondea distinto", () => {
    const unit = fiscalPdfUnitPrice({
      codigo: null, descripcion: "Repuesto", cantidad: 3, importeUnitario: 0.01,
      subtotal: 0.03, importeTotal: 0.04,
    });
    expect(unit.value).toBeCloseTo(0.04 / 3, 8);
    expect(unit.maxDecimals).toBe(6);
    expect(Math.round(unit.value * 3 * 100)).toBe(4);
  });

  it("mantiene el unitario normal cuando coincide con la extensión", () => {
    expect(fiscalPdfUnitPrice({
      codigo: null, descripcion: "Servicio", cantidad: 3, importeUnitario: 10, subtotal: 30, importeTotal: 30,
    })).toEqual({ value: 10, maxDecimals: 2 });
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

  it("deja los conceptos en la primera hoja y pasa el pie arriba de la segunda si no entra", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const lineas = Array.from({ length: 15 }, (_, index) => ({ codigo: null, descripcion: `Servicio ${index + 1}`, cantidad: 1, importeUnitario: 100, subtotal: 100 }));
    const bytes = await generateFiscalInvoicePdf(invoice({ concepto: 1, lineas, total: 1500 }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    const calls = drawText.mock.calls.map(([value, options], index) => ({ value, y: options?.y ?? 0, page: drawText.mock.contexts[index] }));
    const firstPage = calls.find(({ value }) => value === "CÓDIGO")!.page;
    const rows = lineas.map(({ descripcion }) => calls.find(({ value }) => value === descripcion)!);
    expect(rows.every(({ page }) => page === firstPage)).toBe(true);
    expect(rows[0].y - rows[1].y).toBe(20);
    expect(calls.filter(({ value }) => value === "CÓDIGO")).toHaveLength(1);
    const total = calls.find(({ value }) => value === "Importe Total:")!;
    expect(total.page).not.toBe(firstPage);
    expect(total.y).toBeGreaterThan(600);
    drawText.mockRestore();
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

  describe("rótulo del IVA discriminado en clase A", () => {
    const linea = (ivaAlicuota: number, tratamientoIva: "GRAVADO" | "EXENTO" = "GRAVADO") => ({
      codigo: null, descripcion: `Línea ${ivaAlicuota}`, cantidad: 1, importeUnitario: 100, subtotal: 100, tratamientoIva, ivaAlicuota,
    });
    const labelsDe = async (overrides: Partial<FiscalPdfInvoice>) => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      drawText.mockClear();
      await generateFiscalInvoicePdf(invoice(overrides));
      const values = drawText.mock.calls.map(([value]) => String(value));
      drawText.mockRestore();
      return values.filter((value) => value.startsWith("Importe IVA"));
    };

    it.each([[1, "A"], [201, "A"]] as const)("muestra el porcentaje cuando todas las líneas gravadas son al 21%% (%s)", async (tipoComprobante, claseComprobante) => {
      expect(await labelsDe({ tipoComprobante, claseComprobante, lineas: [linea(21), linea(21)] })).toEqual(["Importe IVA 21%:"]);
    });

    it("usa el formato argentino para alícuotas con decimales", async () => {
      expect(await labelsDe({ tipoComprobante: 1, claseComprobante: "A", lineas: [linea(10.5)] })).toEqual(["Importe IVA 10,5%:"]);
    });

    it("ignora las líneas no gravadas al determinar la alícuota", async () => {
      expect(await labelsDe({ tipoComprobante: 1, claseComprobante: "A", lineas: [linea(21), linea(0, "EXENTO")] })).toEqual(["Importe IVA 21%:"]);
    });

    it("no inventa un porcentaje cuando hay alícuotas distintas", async () => {
      expect(await labelsDe({ tipoComprobante: 1, claseComprobante: "A", lineas: [linea(21), linea(10.5)] })).toEqual(["Importe IVA:"]);
    });

    it("conserva el rótulo genérico si las líneas no informan alícuota", async () => {
      expect(await labelsDe({ tipoComprobante: 1, claseComprobante: "A" })).toEqual(["Importe IVA:"]);
    });

    it("no cambia el rótulo en clase B", async () => {
      expect(await labelsDe({ tipoComprobante: 6, claseComprobante: "B", lineas: [linea(21)] })).toEqual(["Importe IVA:"]);
    });

    it("mantiene el importe en la misma fila que el rótulo", async () => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      drawText.mockClear();
      const totales = { netoGravado: 1000, noGravado: 0, exento: 0, iva: 210, tributos: 0, otrosImpuestosNacionales: 0, total: 1210 };
      await generateFiscalInvoicePdf(invoice({ tipoComprobante: 1, claseComprobante: "A", total: 1210, totales, lineas: [linea(21)] }));
      const calls = drawText.mock.calls;
      const label = calls.find(([value]) => value === "Importe IVA 21%:");
      expect(label?.[1]?.x).toBe(330);
      expect(calls.some(([value, options]) => value === "$210,00" && options?.y === label?.[1]?.y)).toBe(true);
      drawText.mockRestore();
    });
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

  it("referencia la factura asociada en notas de crédito y débito, sin pisar el detalle", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const comprobanteAsociado = { tipoComprobante: 6, clase: "B" as const, puntoVenta: 3, numero: 125, fecha: "2026-10-01" };
    for (const [documentoTipo, tipoComprobante] of [["NOTA_CREDITO", 8], ["NOTA_DEBITO", 7]] as const) {
      drawText.mockClear();
      await generateFiscalInvoicePdf(invoice({ documentoTipo, tipoComprobante, claseComprobante: "B", comprobanteAsociado }));
      const calls = drawText.mock.calls;
      const label = calls.find(([value]) => value === "Comprobante asociado:");
      const reference = calls.find(([value]) => value === "Factura B 00003-00000125 del 01/10/2026");
      const condicionVenta = calls.find(([value]) => value === "Condición de Venta:");
      const tableHeader = calls.find(([value]) => value === "CÓDIGO");
      expect(reference?.[1]?.y).toBe(label?.[1]?.y);
      expect(label?.[1]?.y).toBeLessThan(condicionVenta?.[1]?.y ?? 0);
      expect(tableHeader?.[1]?.y).toBeLessThan(label?.[1]?.y ?? 0);
    }
    drawText.mockClear();
    await generateFiscalInvoicePdf(invoice({ comprobanteAsociado }));
    expect(drawText.mock.calls.map(([value]) => value)).not.toContain("Comprobante asociado:");
    drawText.mockRestore();
  });

  describe("Transparencia Fiscal al Consumidor (RG 5614)", () => {
    const title = "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)";
    const totales = { netoGravado: 1000, noGravado: 0, exento: 0, iva: 210, tributos: 15, otrosImpuestosNacionales: 0, total: 1225 };

    it.each([
      ["FACTURA", 6], ["NOTA_CREDITO", 8], ["NOTA_DEBITO", 7],
    ] as const)("informa el IVA contenido ya calculado en %s B, sin usar Otros Tributos", async (documentoTipo, tipoComprobante) => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      await generateFiscalInvoicePdf(invoice({ documentoTipo, tipoComprobante, claseComprobante: "B", total: 1225, totales }));
      const calls = drawText.mock.calls;
      const heading = calls.find(([value]) => value === title);
      const iva = calls.find(([value]) => value === "IVA Contenido:");
      const otros = calls.find(([value]) => value === "Otros Impuestos Nacionales Indirectos:");
      const totalsLabel = calls.find(([value]) => value === "Importe Neto:");
      expect(heading?.[1]).toMatchObject({ x: 46 });
      expect(calls.some(([value, options]) => value === "$210,00" && options?.y === iva?.[1]?.y)).toBe(true);
      expect(calls.some(([value, options]) => value === "$0,00" && options?.y === otros?.[1]?.y)).toBe(true);
      // A la izquierda de los totales y por encima del separador del QR/CAE.
      expect(heading?.[1]?.y).toBe(totalsLabel?.[1]?.y);
      expect(otros?.[1]?.y).toBeGreaterThan(150);
      drawText.mockRestore();
    });

    it.each([[1, "A"], [11, "C"]] as const)("no se agrega en comprobantes clase %s", async (tipoComprobante, claseComprobante) => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      await generateFiscalInvoicePdf(invoice({ tipoComprobante, claseComprobante, totales }));
      expect(drawText.mock.calls.map(([value]) => value)).not.toContain(title);
      drawText.mockRestore();
    });

    it("aparece una sola vez, en la última página, en comprobantes B largos", async () => {
      const drawText = vi.spyOn(PDFPage.prototype, "drawText");
      const lineas = Array.from({ length: 30 }, (_, index) => ({ codigo: null, descripcion: `Repuesto ${index + 1}`, cantidad: 1, importeUnitario: 10, subtotal: 10 }));
      const bytes = await generateFiscalInvoicePdf(invoice({ tipoComprobante: 6, claseComprobante: "B", lineas, total: 1225, totales }));
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
      expect(drawText.mock.calls.filter(([value]) => value === title)).toHaveLength(1);
      drawText.mockRestore();
    });
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

describe("vista HTML del comprobante", () => {
  const unescapeHtml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const htmlTexts = (html: string) => [...html.matchAll(/<text [^>]*>(.*?)<\/text>/g)].map(([, value]) => unescapeHtml(value));
  const count = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;

  const draft = { draft: true, numeroComprobante: null, cae: null, caeVencimiento: null } as const;
  const emisorFce = { ...invoice().emisorSnapshot, ingresosBrutos: "123-456789-0" };
  const totales = { netoGravado: 1000, noGravado: 0, exento: 0, iva: 210, tributos: 15, otrosImpuestosNacionales: 0, total: 1225 };
  const lineas = (cantidad: number) => Array.from({ length: cantidad }, (_, index) => ({
    codigo: `REP-${index + 1}`,
    descripcion: `Repuesto ${index + 1} con una descripción suficientemente larga para ocupar más de una línea en el detalle fiscal.`,
    cantidad: 2, importeUnitario: 100, subtotal: 200,
  }));

  const casos: [string, Partial<FiscalPdfInvoice>][] = [
    ["borrador monotributo", { ...draft }],
    ["borrador FCE B de varias hojas", { ...draft, tipoComprobante: 206, claseComprobante: "B", emisorSnapshot: emisorFce, fceSistema: "ADC", fceCbu: "1234567890123456789012", totales, total: 1225, lineas: lineas(30) }],
    ["clase A con alícuota", { ...draft, tipoComprobante: 1, claseComprobante: "A", total: 1210, totales: { ...totales, tributos: 0, total: 1210 }, lineas: [{ ...lineas(1)[0], tratamientoIva: "GRAVADO", ivaAlicuota: 21 }] }],
    ["pie en una hoja propia", { ...draft, concepto: 1, lineas: lineas(15).map((line) => ({ ...line, descripcion: "Servicio" })) }],
    ["receptor con nombre y domicilio largos", { ...draft, receptorSnapshot: { nombre: "Razón Social Muy Larga ".repeat(6), domicilio: "Avenida Siempre Viva 742, Piso 3 ".repeat(4), tipoDocumento: 99, numeroDocumento: "0", condicionIvaReceptorId: 5 } }],
    ["comprobante autorizado con QR", {}],
  ];

  it.each(casos)("dibuja lo mismo que el PDF, hoja por hoja: %s", async (_name, overrides) => {
    const input = invoice(overrides);
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const drawRectangle = vi.spyOn(PDFPage.prototype, "drawRectangle");
    const drawLine = vi.spyOn(PDFPage.prototype, "drawLine");
    const drawImage = vi.spyOn(PDFPage.prototype, "drawImage");

    const pdf = await PDFDocument.load(await generateFiscalInvoicePdf(input));
    const drawn = {
      texts: drawText.mock.calls.map(([value]) => value),
      rectangles: drawRectangle.mock.calls.length,
      lines: drawLine.mock.calls.length,
      images: drawImage.mock.calls.length,
    };
    const html = await generateFiscalInvoiceHtml(input);

    expect(htmlTexts(html)).toEqual(drawn.texts);
    expect(count(html, "rect")).toBe(drawn.rectangles);
    expect(count(html, "line")).toBe(drawn.lines);
    expect(count(html, "image")).toBe(drawn.images);
    expect(count(html, "svg")).toBe(pdf.getPageCount());
  });

  it("usa las mismas coordenadas en puntos que el PDF, con el eje vertical invertido", async () => {
    const html = await generateFiscalInvoiceHtml(invoice(draft));
    expect(html).toContain('viewBox="0 0 595.28 841.89" width="595.28pt" height="841.89pt"');
    // El encabezado del PDF es un rectángulo blanco en x 38, y 588, de 519,28 × 210 puntos.
    expect(html).toContain('<rect x="38" y="43.89" width="519.28" height="210" fill="rgb(255,255,255)" stroke="rgb(0,0,0)" stroke-width="0.8"/>');
    expect(html).toContain('font-weight="700"');
  });

  it("informa número, CAE y QR pendientes en un borrador, sin inventarlos", async () => {
    const html = await generateFiscalInvoiceHtml(invoice(draft));
    const texts = htmlTexts(html);
    expect(texts).toContain("Pendiente");
    expect(texts).toContain("CAE N°: Pendiente");
    expect(texts.some((value) => value.startsWith("QR disponible"))).toBe(true);
    expect(texts).toContain("Borrador sin validez fiscal");
    expect(html).not.toContain("<image");
  });

  it("incluye el QR de ARCA y el CAE en un comprobante autorizado", async () => {
    const html = await generateFiscalInvoiceHtml(invoice());
    expect(htmlTexts(html)).toContain("CAE N°: 86350822627580");
    expect(html).toContain('<image href="data:image/svg+xml;base64,');
  });

  it("escapa el texto libre y lo muestra literal", async () => {
    const html = await generateFiscalInvoiceHtml(invoice({
      ...draft,
      receptorSnapshot: { ...invoice().receptorSnapshot, nombre: `<img src=x onerror="alert(1)"> & Cía`, domicilio: "</text><script>alert(1)</script>" },
    }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(htmlTexts(html).some((value) => value.includes(`<img src=x onerror="alert(1)">`))).toBe(true);
  });

  it("no genera ni serializa un PDF", async () => {
    const save = vi.spyOn(PDFDocument.prototype, "save");
    const addPage = vi.spyOn(PDFDocument.prototype, "addPage");
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    await generateFiscalInvoiceHtml(invoice(draft));
    expect(save).not.toHaveBeenCalled();
    expect(addPage).not.toHaveBeenCalled();
    expect(drawText).not.toHaveBeenCalled();
  });

  it("falla donde falla el PDF para no aprobar un comprobante que después no se puede generar", async () => {
    const sinIibb = invoice({ ...draft, tipoComprobante: 211, emisorSnapshot: { ...invoice().emisorSnapshot, ingresosBrutos: "-" } });
    await expect(generateFiscalInvoiceHtml(sinIibb)).rejects.toThrow("Completá la inscripción o condición");

    // WinAnsi no codifica un emoji; el PDF lo rechaza y la vista previa también.
    const conEmoji = invoice({ ...draft, lineas: [{ codigo: "R🔧", descripcion: "Repuesto", cantidad: 1, importeUnitario: 100, subtotal: 100 }] });
    await expect(generateFiscalInvoicePdf(conEmoji)).rejects.toThrow();
    await expect(generateFiscalInvoiceHtml(conEmoji)).rejects.toThrow();
  });
});
