import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateRemitoPdf, remitoPdfFilename } from "./remitoPdf";
import type { RemitoDetalle } from "./types";

function remito(overrides: Partial<RemitoDetalle> = {}): RemitoDetalle {
  return {
    id: "remito-1",
    clase: "X",
    puntoEmision: 1,
    numero: 8,
    numeroVisible: "X 00001-00000008",
    fechaEmision: "2026-10-06",
    ambiente: "HOMOLOGACION",
    arregloId: null,
    destinatarioNombre: "Juan Pérez",
    destinatarioDocumento: "DNI 30111222",
    tipoComprobante: null,
    emisor: {
      razonSocial: "Taller Remitos SRL",
      nombreFantasia: "Taller Remitos",
      cuit: "20123456786",
      domicilio: "Av. Siempreviva 742",
      ingresosBrutos: "901-123456-7",
      inicioActividades: "2020-01-01",
      condicionIvaEmisor: "RESPONSABLE_INSCRIPTO",
      condicionIva: "Responsable inscripto",
    },
    destinatario: {
      clienteId: null,
      nombre: "Juan Pérez",
      domicilio: "Calle 1",
      tipoDocumento: 96,
      numeroDocumento: "30111222",
      condicionIvaReceptorId: 5,
      condicionIva: "Consumidor final",
    },
    transportista: null,
    cai: null,
    caiVencimiento: null,
    impresion: null,
    observaciones: null,
    lineas: [{
      id: "linea-1",
      ordinal: 1,
      codigo: "NEU-1",
      descripcion: "Neumático 195/65 R15",
      observaciones: "Con válvula",
      cantidad: 4,
      facturaLineaId: null,
    }],
    factura: null,
    facturaAsociadaAt: null,
    createdAt: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}

function remitoR(overrides: Partial<RemitoDetalle> = {}): RemitoDetalle {
  return remito({
    clase: "R",
    numeroVisible: "R 00001-00000008",
    tipoComprobante: 91,
    cai: "71234567890123",
    caiVencimiento: "2026-12-31",
    impresion: {
      autoimpresor: false,
      numeroDesde: 1,
      numeroHasta: 100,
      inicioActividades: "2021-05-01",
      imprenta: { razonSocial: "Imprenta Sur SA", cuit: "30712345671", fechaImpresion: "2026-01-15", habilitacion: "1234" },
    },
    ...overrides,
  });
}

async function textosDibujados(detalle: RemitoDetalle): Promise<{ textos: string[]; bytes: Uint8Array }> {
  const drawText = vi.spyOn(PDFPage.prototype, "drawText");
  const bytes = await generateRemitoPdf(detalle);
  const textos = drawText.mock.calls.map(([value]) => String(value));
  drawText.mockRestore();
  return { textos, bytes };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PDF de remito", () => {
  it("genera un PDF válido de una página para X sin código de comprobante ni CAI", async () => {
    const { textos, bytes } = await textosDibujados(remito());

    expect(Buffer.from(bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe("Remito X 00001-00000008");
    expect(textos).toEqual(expect.arrayContaining([
      "REMITO", "X", "DOCUMENTO NO VÁLIDO COMO FACTURA", "Recibí conforme", "Firma", "Aclaración",
      "00001", "00000008", "06/10/2026", "NEU-1", "Neumático 195/65 R15", "Con válvula", "4",
    ]));
    expect(textos.some((value) => value.startsWith("COD."))).toBe(false);
    expect(textos.some((value) => value.startsWith("CAI"))).toBe(false);
    expect(textos.some((value) => value.startsWith("Página"))).toBe(false);
  });

  it("muestra COD. 091, CAI, vencimiento, rango e imprenta en el remito R", async () => {
    const { textos, bytes } = await textosDibujados(remitoR());

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(textos).toEqual(expect.arrayContaining([
      "R",
      "COD. 091",
      "CAI N°: 71234567890123",
      "Fecha de Vto.: 31/12/2026",
      "Numeración del 00001-00000001 al 00001-00000100",
      "01/05/2021",
    ]));
    expect(textos.join(" ")).toContain("Imprenta: Imprenta Sur SA – CUIT 30712345671 – Hab. N° 1234 – F. Imp.: 15/01/2026");
  });

  it("omite la imprenta cuando el contribuyente es autoimpresor", async () => {
    const detalle = remitoR();
    const { textos } = await textosDibujados(remitoR({
      impresion: { ...detalle.impresion!, autoimpresor: true, imprenta: null, numeroDesde: null, numeroHasta: null },
    }));

    expect(textos.some((value) => value.startsWith("Imprenta:"))).toBe(false);
    expect(textos.some((value) => value.startsWith("Numeración del"))).toBe(false);
    expect(textos).toContain("CAI N°: 71234567890123");
  });

  it("incluye transportista y factura asociada solo cuando existen", async () => {
    const sinDatos = await textosDibujados(remito());
    expect(sinDatos.textos).not.toContain("TRANSPORTISTA");
    expect(sinDatos.textos).not.toContain("Factura asociada:");

    const conDatos = await textosDibujados(remito({
      transportista: { nombre: "Fletes del Sur", domicilio: "Ruta 3 km 10", cuit: "20123456786" },
      factura: { id: "f1", label: "Factura C 00001-00000123", fechaComprobante: "2026-10-01", receptorNombre: null, receptorDocumento: null },
    }));
    expect(conDatos.textos).toEqual(expect.arrayContaining([
      "TRANSPORTISTA", "Fletes del Sur", "Ruta 3 km 10", "Factura asociada:", "Factura C 00001-00000123",
    ]));
  });

  it("mantiene dentro del recuadro los textos del emisor que envuelven cerca del borde", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const drawRectangle = vi.spyOn(PDFPage.prototype, "drawRectangle");
    await generateRemitoPdf(remito({
      emisor: {
        ...remito().emisor,
        razonSocial: "Razón social comercial extensa ".repeat(6).slice(0, 200),
        domicilio: "Avenida comercial de prueba ".repeat(12).slice(0, 300),
      },
    }));

    const calls = drawText.mock.calls.map(([value, options], index) => ({
      value: String(value),
      y: Number(options?.y),
      page: drawText.mock.contexts[index],
    }));
    const condicion = calls.find((call) => call.value === "Condición IVA:");
    const destinatario = calls.find((call) => call.value === "DESTINATARIO");
    const domicilioLabelIndex = calls.findIndex((call) => call.value === "Domicilio Comercial:");
    const condicionIndex = calls.findIndex((call) => call.value === "Condición IVA:");
    const domicilioLines = calls.slice(domicilioLabelIndex + 1, condicionIndex);
    const headerBottom = Number(drawRectangle.mock.calls[0]?.[0]?.y);

    expect(condicion).toBeDefined();
    expect(destinatario).toBeDefined();
    expect(condicion!.page).toBe(destinatario!.page);
    expect(condicion!.y).toBeGreaterThan(destinatario!.y);
    expect(domicilioLines.length).toBeGreaterThan(1);
    expect(Math.min(...domicilioLines.map((line) => line.y))).toBeGreaterThanOrEqual(headerBottom);
  });

  it("pagina 200 ítems con descripciones largas y numera todas las páginas", async () => {
    const lineas = Array.from({ length: 200 }, (_, index) => ({
      id: `linea-${index}`,
      ordinal: index + 1,
      codigo: `REP-${index + 1}`,
      descripcion: `Repuesto ${index + 1} con una descripción suficientemente larga para ocupar más de una línea en la tabla del remito.`,
      observaciones: index % 3 === 0 ? "Entregar en mano al responsable del depósito" : null,
      cantidad: 1.5,
      facturaLineaId: null,
    }));
    const { textos, bytes } = await textosDibujados(remitoR({ lineas, observaciones: "Entrega parcial" }));

    const pages = (await PDFDocument.load(bytes)).getPageCount();
    expect(pages).toBeGreaterThan(1);
    expect(textos).toContain(`Página 1 de ${pages}`);
    expect(textos).toContain(`Página ${pages} de ${pages}`);
    expect(textos.filter((value) => value === "Recibí conforme")).toHaveLength(1);
    expect(textos.filter((value) => value.startsWith("CAI N°"))).toHaveLength(1);
    expect(textos).toContain("REMITO R 00001-00000008");
    expect(textos).toContain("1,5");
  });

  it("deja el pie de la última página por debajo de la última fila", async () => {
    const drawText = vi.spyOn(PDFPage.prototype, "drawText");
    const lineas = Array.from({ length: 24 }, (_, index) => ({
      id: `linea-${index}`,
      ordinal: index + 1,
      codigo: `REP-${index + 1}`,
      descripcion: `Repuesto ${index + 1}`,
      observaciones: null,
      cantidad: 1,
      facturaLineaId: null,
    }));
    await generateRemitoPdf(remitoR({ lineas, observaciones: "Observación general del remito" }));

    const calls = drawText.mock.calls.map(([value, options], index) => ({
      value: String(value),
      y: Number(options?.y),
      page: drawText.mock.contexts[index],
    }));
    const recibi = calls.find((call) => call.value === "Recibí conforme");
    const filasMismaPagina = calls.filter((call) => call.page === recibi?.page && /^REP-\d+$/.test(call.value));
    expect(recibi).toBeDefined();
    for (const fila of filasMismaPagina) {
      expect(fila.y).toBeGreaterThan(recibi!.y);
    }
  });

  it("no dibuja importes, símbolos de moneda ni totales", async () => {
    const { textos } = await textosDibujados(remitoR({
      factura: { id: "f1", label: "Factura C 00001-00000123", fechaComprobante: "2026-10-01", receptorNombre: null, receptorDocumento: null },
      transportista: { nombre: "Fletes", domicilio: null, cuit: null },
    }));

    for (const value of textos) {
      expect(value).not.toMatch(/\$|ARS|total|importe|subtotal|precio/i);
    }
  });

  it("sanitiza caracteres fuera de WinAnsi sin romper la generación", async () => {
    const { textos, bytes } = await textosDibujados(remito({
      destinatario: { ...remito().destinatario, nombre: "Cliente 🚗 “Especial”" },
      lineas: [{ ...remito().lineas[0], descripcion: "Pieza ✓ 漢字", observaciones: "Frágil ⚠️" }],
    }));

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(textos.join(" ")).toContain("Cliente ? “Especial”");
    expect(textos.join(" ")).toContain("Pieza ? ??");
  });

  it("arma el nombre de archivo con clase, punto y número", () => {
    expect(remitoPdfFilename({ clase: "R", puntoEmision: 1, numero: 8 })).toBe("remito-r-00001-00000008.pdf");
  });
});
