import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import {
  CONDICIONES_IVA_RECEPTOR,
  TIPOS_DOCUMENTO_FISCAL,
  type DocumentoFiscalClase,
  type FacturaClase,
  type FacturaTotales,
} from "./types";

const ARCA_QR_URL = "https://www.arca.gob.ar/fe/qr/?p=";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const WHITE = rgb(1, 1, 1);

type FiscalRecord = Record<string, unknown>;

export type FiscalPdfLine = {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  importeUnitario: number;
  subtotal: number;
};

export type FiscalPdfInvoice = {
  id: string;
  emisorSnapshot: FiscalRecord;
  receptorSnapshot: FiscalRecord;
  concepto: number;
  fechaComprobante: string;
  fechaServicioDesde: string | null;
  fechaServicioHasta: string | null;
  fechaVencimientoPago: string | null;
  total: number;
  puntoVenta: number;
  tipoComprobante: number;
  claseComprobante?: FacturaClase;
  documentoTipo?: DocumentoFiscalClase;
  condicionVenta?: string;
  totales?: FacturaTotales;
  numeroComprobante: number;
  cae: string;
  caeVencimiento: string;
  lineas: FiscalPdfLine[];
};

export type ArcaQrPayload = {
  ver: 1;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: "PES";
  ctz: 1;
  tipoDocRec: number;
  nroDocRec: number;
  tipoCodAut: "E";
  codAut: number;
};

type PrintableRow = FiscalPdfLine & {
  descriptionLines: string[];
  continuation: boolean;
  height: number;
};

type PrintablePage = {
  rows: PrintableRow[];
  continuation: boolean;
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null | undefined): string {
  const iso = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }
  return iso || "-";
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function drawRight(page: PDFPage, value: string, right: number, y: number, font: PDFFont, size: number) {
  page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, font, size });
}

function drawCentered(page: PDFPage, value: string, center: number, y: number, font: PDFFont, size: number) {
  page.drawText(value, { x: center - font.widthOfTextAtSize(value, size) / 2, y, font, size });
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = value.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let fragment = "";
      for (const character of word) {
        const next = `${fragment}${character}`;
        if (fragment && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = next;
        }
      }
      current = fragment;
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : ["-"];
}

function printableRows(lines: FiscalPdfLine[], font: PDFFont): PrintableRow[] {
  const output: PrintableRow[] = [];
  for (const line of lines) {
    const wrapped = wrapText(line.descripcion || "-", font, 8, 230);
    for (let offset = 0; offset < wrapped.length; offset += 28) {
      const descriptionLines = wrapped.slice(offset, offset + 28);
      output.push({
        ...line,
        codigo: offset === 0 ? line.codigo : null,
        cantidad: offset === 0 ? line.cantidad : 0,
        importeUnitario: offset === 0 ? line.importeUnitario : 0,
        subtotal: offset === 0 ? line.subtotal : 0,
        descriptionLines,
        continuation: offset > 0,
        height: Math.max(28, descriptionLines.length * 10 + 10),
      });
    }
  }
  return output;
}

function firstTableStart(invoice: FiscalPdfInvoice): number {
  return invoice.concepto === 1 ? 493 : 462;
}

function paginate(invoice: FiscalPdfInvoice, rows: PrintableRow[]): PrintablePage[] {
  const pages: PrintablePage[] = [{ rows: [], continuation: false }];
  let remaining = firstTableStart(invoice) - 55;
  for (const row of rows) {
    if (row.height > remaining && pages[pages.length - 1].rows.length > 0) {
      pages.push({ rows: [], continuation: true });
      remaining = 755 - 55;
    }
    pages[pages.length - 1].rows.push(row);
    remaining -= row.height;
  }

  const last = pages[pages.length - 1];
  const lastCapacityWithFooter = (last.continuation ? 755 : firstTableStart(invoice)) - 245;
  const used = last.rows.reduce((sum, row) => sum + row.height, 0);
  if (used > lastCapacityWithFooter && last.rows.length > 0) {
    const moved: PrintableRow[] = [];
    let movedHeight = 0;
    while (last.rows.length > 0) {
      const candidate = last.rows[last.rows.length - 1];
      if (moved.length > 0 && movedHeight + candidate.height > 510) break;
      moved.unshift(last.rows.pop() as PrintableRow);
      movedHeight += candidate.height;
      if (used - movedHeight <= (last.continuation ? 700 : firstTableStart(invoice) - 55)) break;
    }
    pages.push({ rows: moved, continuation: true });
  }
  return pages;
}

export function buildArcaQrPayload(invoice: FiscalPdfInvoice): ArcaQrPayload {
  const emitter = invoice.emisorSnapshot;
  const receiver = invoice.receptorSnapshot;
  return {
    ver: 1,
    fecha: invoice.fechaComprobante,
    cuit: number(emitter.cuit),
    ptoVta: invoice.puntoVenta,
    tipoCmp: invoice.tipoComprobante,
    nroCmp: invoice.numeroComprobante,
    importe: invoice.total,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: number(receiver.tipoDocumento),
    nroDocRec: number(receiver.numeroDocumento),
    tipoCodAut: "E",
    codAut: number(invoice.cae),
  };
}

export function buildArcaQrUrl(invoice: FiscalPdfInvoice): string {
  const json = JSON.stringify(buildArcaQrPayload(invoice));
  return `${ARCA_QR_URL}${Buffer.from(json, "utf8").toString("base64")}`;
}

function drawLabeledValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  y: number,
  valueX: number,
) {
  page.drawText(label, { x, y, font: fonts.bold, size: 8 });
  page.drawText(value || "-", { x: valueX, y, font: fonts.regular, size: 8 });
}

function drawFirstHeader(page: PDFPage, invoice: FiscalPdfInvoice, fonts: Fonts) {
  const emitter = invoice.emisorSnapshot;
  const receiver = invoice.receptorSnapshot;
  const topY = 588;
  page.drawRectangle({ x: MARGIN, y: topY, width: CONTENT_WIDTH, height: 210, color: WHITE, borderWidth: 0.8 });
  page.drawLine({ start: { x: 298, y: topY }, end: { x: 298, y: topY + 210 }, thickness: 0.8 });

  drawCentered(page, text(emitter.nombreFantasia) || text(emitter.razonSocial), 168, 757, fonts.bold, 17);
  drawLabeledValue(page, fonts, "Razón Social:", text(emitter.razonSocial), 54, 716, 115);
  drawLabeledValue(page, fonts, "Domicilio Comercial:", text(emitter.domicilio), 54, 699, 139);
  drawLabeledValue(page, fonts, "Condición IVA:", text(emitter.condicionIva) || "Monotributista", 54, 682, 119);

  page.drawRectangle({ x: 276, y: 744, width: 44, height: 54, color: WHITE, borderWidth: 0.8 });
  drawCentered(page, invoice.claseComprobante ?? "C", 298, 766, fonts.bold, 22);
  drawCentered(page, `COD. ${String(invoice.tipoComprobante).padStart(3, "0")}`, 298, 751, fonts.bold, 6.5);

  const documentLabel = invoice.documentoTipo === "FACTURA"
    ? "FACTURA" : invoice.documentoTipo === "NOTA_CREDITO" ? "NOTA DE CRÉDITO" : "NOTA DE DÉBITO";
  page.drawText(documentLabel, { x: 330, y: 758, font: fonts.bold, size: invoice.documentoTipo === "FACTURA" ? 18 : 12 });
  drawLabeledValue(page, fonts, "Punto de Venta:", String(invoice.puntoVenta).padStart(5, "0"), 330, 731, 414);
  drawLabeledValue(page, fonts, "Comp. Nro:", String(invoice.numeroComprobante).padStart(8, "0"), 330, 714, 414);
  drawLabeledValue(page, fonts, "Fecha de Emisión:", formatDate(invoice.fechaComprobante), 330, 697, 414);
  drawLabeledValue(page, fonts, "CUIT:", text(emitter.cuit), 330, 680, 414);
  drawLabeledValue(page, fonts, "Ingresos Brutos:", text(emitter.ingresosBrutos) || "-", 330, 663, 414);
  drawLabeledValue(page, fonts, "Inicio de Act.:", formatDate(text(emitter.inicioActividades)), 330, 646, 414);

  let receiverTop = 574;
  if (invoice.concepto !== 1) {
    page.drawRectangle({ x: MARGIN, y: 542, width: CONTENT_WIDTH, height: 31, color: WHITE, borderWidth: 0.8 });
    drawLabeledValue(page, fonts, "Período Facturado Desde:", formatDate(invoice.fechaServicioDesde), 50, 554, 164);
    drawLabeledValue(page, fonts, "Hasta:", formatDate(invoice.fechaServicioHasta), 252, 554, 284);
    drawLabeledValue(page, fonts, "Fecha de Vto. para el pago:", formatDate(invoice.fechaVencimientoPago), 365, 554, 488);
    receiverTop = 527;
  }

  const receiverBottom = receiverTop - 65;
  page.drawRectangle({ x: MARGIN, y: receiverBottom, width: CONTENT_WIDTH, height: 65, color: WHITE, borderWidth: 0.8 });
  const receiverDocumentLabel = TIPOS_DOCUMENTO_FISCAL.find((item) => item.id === number(receiver.tipoDocumento))?.label ?? "Documento";
  const ivaLabel = CONDICIONES_IVA_RECEPTOR.find((item) => item.id === number(receiver.condicionIvaReceptorId))?.label ?? "Consumidor final";
  drawLabeledValue(page, fonts, `${receiverDocumentLabel}:`, text(receiver.numeroDocumento), 50, receiverTop - 19, 90);
  drawLabeledValue(page, fonts, "Apellido y Nombre / Razón Social:", text(receiver.nombre), 298, receiverTop - 19, 438);
  drawLabeledValue(page, fonts, "Condición IVA:", ivaLabel, 50, receiverTop - 38, 116);
  drawLabeledValue(page, fonts, "Domicilio:", text(receiver.domicilio) || "-", 298, receiverTop - 38, 352);
  drawLabeledValue(page, fonts, "Condición de Venta:", invoice.condicionVenta || "Contado", 50, receiverTop - 56, 141);
}

function drawContinuationHeader(page: PDFPage, invoice: FiscalPdfInvoice, fonts: Fonts, pageNumber: number) {
  const emitter = invoice.emisorSnapshot;
  page.drawText(text(emitter.nombreFantasia) || text(emitter.razonSocial), { x: MARGIN, y: 798, font: fonts.bold, size: 14 });
  const kind = invoice.documentoTipo === "FACTURA" ? "FACTURA"
    : invoice.documentoTipo === "NOTA_CREDITO" ? "NC" : "ND";
  const label = `${kind} ${invoice.claseComprobante ?? "C"} ${String(invoice.puntoVenta).padStart(5, "0")}-${String(invoice.numeroComprobante).padStart(8, "0")}`;
  drawRight(page, label, PAGE_WIDTH - MARGIN, 798, fonts.bold, 11);
  drawRight(page, `Página ${pageNumber}`, PAGE_WIDTH - MARGIN, 782, fonts.regular, 8);
  page.drawLine({ start: { x: MARGIN, y: 775 }, end: { x: PAGE_WIDTH - MARGIN, y: 775 }, thickness: 0.8 });
}

function drawTableHeader(page: PDFPage, y: number, fonts: Fonts) {
  page.drawRectangle({ x: MARGIN, y: y - 21, width: CONTENT_WIDTH, height: 21, color: rgb(0.18, 0.18, 0.18) });
  const headers = [
    ["CÓDIGO", 46],
    ["PRODUCTO / SERVICIO", 109],
    ["CANTIDAD", 357],
    ["PRECIO UNIT.", 421],
    ["SUBTOTAL", 505],
  ] as const;
  for (const [label, x] of headers) page.drawText(label, { x, y: y - 14, font: fonts.bold, size: 7.5, color: rgb(1, 1, 1) });
}

function drawRows(page: PDFPage, rows: PrintableRow[], startY: number, fonts: Fonts): number {
  let y = startY - 21;
  for (const row of rows) {
    const textY = y - 15;
    if (!row.continuation) {
      page.drawText(row.codigo || "-", { x: 46, y: textY, font: fonts.regular, size: 8 });
      drawCentered(page, formatNumber(row.cantidad), 383, textY, fonts.regular, 8);
      drawRight(page, formatAmount(row.importeUnitario), 482, textY, fonts.regular, 8);
      drawRight(page, formatAmount(row.subtotal), 550, textY, fonts.regular, 8);
    }
    row.descriptionLines.forEach((line, index) => {
      page.drawText(line || " ", { x: 109, y: textY - index * 10, font: fonts.regular, size: 8 });
    });
    y -= row.height;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.35, color: rgb(0.82, 0.82, 0.82) });
  }
  return y;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("es-AR", { maximumFractionDigits: 4 });
}

async function drawFooter(
  pdf: PDFDocument,
  page: PDFPage,
  invoice: FiscalPdfInvoice,
  fonts: Fonts,
) {
  drawLabeledValue(page, fonts, "Importe Neto:", formatAmount(invoice.totales?.netoGravado ?? invoice.total), 350, 238, 489);
  drawLabeledValue(page, fonts, "Importe IVA:", formatAmount(invoice.totales?.iva ?? 0), 350, 220, 489);
  drawLabeledValue(page, fonts, "Otros Tributos:", formatAmount(invoice.totales?.tributos ?? 0), 350, 204, 489);
  page.drawLine({ start: { x: 350, y: 190 }, end: { x: 557, y: 190 }, thickness: 0.8 });
  page.drawText("Importe Total:", { x: 350, y: 172, font: fonts.bold, size: 11 });
  drawRight(page, formatAmount(invoice.total), 557, 172, fonts.bold, 11);
  page.drawLine({ start: { x: MARGIN, y: 150 }, end: { x: PAGE_WIDTH - MARGIN, y: 150 }, thickness: 0.35, color: rgb(0.75, 0.75, 0.75) });

  const qrBytes = await QRCode.toBuffer(buildArcaQrUrl(invoice), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 0,
    width: 300,
  });
  const qr = await pdf.embedPng(Uint8Array.from(qrBytes));
  page.drawImage(qr, { x: 42, y: 28, width: 112, height: 112 });
  drawRight(page, `CAE N°: ${invoice.cae}`, 557, 91, fonts.bold, 10);
  drawRight(page, `Fecha de Vto. de CAE: ${formatDate(invoice.caeVencimiento)}`, 557, 73, fonts.bold, 9);
  drawRight(page, "Comprobante autorizado por ARCA", 557, 52, fonts.regular, 8);
  drawRight(page, "Generado por B2Car", 557, 38, fonts.regular, 7);
}

export async function generateFiscalInvoicePdf(invoice: FiscalPdfInvoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${invoice.documentoTipo ?? "FACTURA"} ${invoice.claseComprobante ?? "C"} ${invoice.puntoVenta}-${invoice.numeroComprobante}`);
  pdf.setSubject("Comprobante electrónico autorizado por ARCA");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const pages = paginate(invoice, printableRows(invoice.lineas, fonts.regular));

  for (let index = 0; index < pages.length; index += 1) {
    const printablePage = pages[index];
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (printablePage.continuation) {
      drawContinuationHeader(page, invoice, fonts, index + 1);
    } else {
      drawFirstHeader(page, invoice, fonts);
    }
    const tableStart = printablePage.continuation ? 755 : firstTableStart(invoice);
    drawTableHeader(page, tableStart, fonts);
    drawRows(page, printablePage.rows, tableStart, fonts);
    if (index === pages.length - 1) await drawFooter(pdf, page, invoice, fonts);
  }

  return pdf.save({ useObjectStreams: false });
}
