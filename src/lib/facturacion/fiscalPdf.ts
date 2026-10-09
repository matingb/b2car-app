import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatArs, formatNumberAr } from "../format";
import { FacturacionValidationError } from "./arcaPayload";
import {
  amountInPesosWords, emitterCommercialAddress, emitterFiscalIvaLabel,
  fceLegalLegend, hasFiscalIibb, isFceInvoice, receiverFiscalIvaLabel,
} from "./fiscalPresentation";
import {
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
const FOOTER_SEPARATOR_Y = 150;
const FCE_LEGEND_FONT_SIZE = 7;
const FCE_LEGEND_LINE_HEIGHT = 9;
const FCE_LEGEND_BOTTOM_GAP = 10;

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
  fceSistema?: "SCA" | "ADC" | null;
  fceCbu?: string | null;
  claseComprobante?: FacturaClase;
  documentoTipo?: DocumentoFiscalClase;
  condicionVenta?: string;
  totales?: FacturaTotales;
  numeroComprobante: number;
  cae: string;
  caeVencimiento: string;
  lineas: FiscalPdfLine[];
  /** Actual linked documents only; this branch does not yet have a remitos data source. */
  remitosAsociados?: { clase: "R" | "X"; puntoEmision: number; numero: number }[];
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
  fullWidth?: boolean;
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
  return formatArs(value, { minDecimals: 2, maxDecimals: 2 });
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

function firstTableStart(invoice: FiscalPdfInvoice, receiverExtraHeight = 0): number {
  return (invoice.concepto === 1 && !isFceInvoice(invoice.tipoComprobante) ? 493 : 462) - receiverExtraHeight;
}

function paginate(rows: PrintableRow[], firstTableY: number, footerTop: number): PrintablePage[] {
  const pages: PrintablePage[] = [{ rows: [], continuation: false }];
  let remaining = firstTableY - 21 - 38;
  for (const row of rows) {
    if (row.height > remaining) {
      pages.push({ rows: [], continuation: true });
      remaining = 755 - 21 - 38;
    }
    pages[pages.length - 1].rows.push(row);
    remaining -= row.height;
  }

  const last = pages[pages.length - 1];
  const lastCapacityWithFooter = (last.continuation ? 755 : firstTableY) - 21 - footerTop - 15;
  const used = last.rows.reduce((sum, row) => sum + row.height, 0);
  if (used > lastCapacityWithFooter && last.rows.length > 0) {
    const moved: PrintableRow[] = [];
    let movedHeight = 0;
    const finalPageCapacity = 755 - 21 - footerTop - 15;
    while (last.rows.length > 0) {
      const candidate = last.rows[last.rows.length - 1];
      if (movedHeight + candidate.height > finalPageCapacity) break;
      moved.unshift(last.rows.pop() as PrintableRow);
      movedHeight += candidate.height;
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
  const printableValue = value.trim() === "0" ? "" : value || "-";
  if (printableValue) page.drawText(printableValue, { x: valueX, y, font: fonts.regular, size: 8 });
}

function drawLabeledWrappedValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  y: number,
  valueX: number,
  maxWidth: number,
): string[] {
  page.drawText(label, { x, y, font: fonts.bold, size: 8 });
  const lines = wrapText(value || "-", fonts.regular, 8, maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, { x: valueX, y: y - index * 10, font: fonts.regular, size: 8 });
  });
  return lines;
}

type FirstHeaderLayout = {
  receiverNameLines: string[];
  receiverNameExtraHeight: number;
  receiverAddressLines: string[];
  receiverExtraHeight: number;
  receiverIvaLines: string[];
  receiverIvaExtraHeight: number;
};

function getFirstHeaderLayout(invoice: FiscalPdfInvoice, fonts: Fonts): FirstHeaderLayout {
  const receiver = invoice.receptorSnapshot;
  const nameLabel = "Apellido y Nombre / Razón Social:";
  const nameValueX = 50 + fonts.bold.widthOfTextAtSize(nameLabel, 8) + 8;
  const rightEdge = PAGE_WIDTH - MARGIN - 12;
  const receiverNameLines = wrapText(
    text(receiver.nombre) || "-",
    fonts.regular,
    8,
    rightEdge - nameValueX,
  );
  const receiverAddressLines = wrapText(
    text(receiver.domicilio) || "-",
    fonts.regular,
    8,
    rightEdge - 352,
  );
  const receiverNameExtraHeight = Math.max(0, receiverNameLines.length - 1) * 10;
  const receiverAddressExtraHeight = Math.max(0, receiverAddressLines.length - 1) * 10;
  const receiverIvaLines = wrapText(receiverFiscalIvaLabel(number(receiver.condicionIvaReceptorId)), fonts.regular, 8, rightEdge - 360);
  const receiverIvaExtraHeight = Math.max(0, receiverIvaLines.length - 1) * 10;
  return {
    receiverNameLines,
    receiverNameExtraHeight,
    receiverAddressLines,
    receiverExtraHeight: receiverNameExtraHeight + receiverAddressExtraHeight + receiverIvaExtraHeight,
    receiverIvaLines,
    receiverIvaExtraHeight,
  };
}

function drawFirstHeader(
  page: PDFPage,
  invoice: FiscalPdfInvoice,
  fonts: Fonts,
  layout: FirstHeaderLayout,
) {
  const emitter = invoice.emisorSnapshot;
  const receiver = invoice.receptorSnapshot;
  const topY = 588;
  page.drawRectangle({ x: MARGIN, y: topY, width: CONTENT_WIDTH, height: 210, color: WHITE, borderWidth: 0.8 });
  page.drawLine({ start: { x: 298, y: topY }, end: { x: 298, y: topY + 210 }, thickness: 0.8 });

  const issuerName = text(emitter.nombreFantasia) || text(emitter.razonSocial);
  const issuerNameLines = wrapText(issuerName, fonts.bold, 14, 210);
  issuerNameLines.forEach((line, index) => {
    drawCentered(page, line, 168, 772 - index * 15, fonts.bold, 14);
  });
  const issuerInfoY = Math.min(716, 772 - (issuerNameLines.length - 1) * 15 - 22);
  const razonSocialLines = drawLabeledWrappedValue(
    page, fonts, "Razón Social:", text(emitter.razonSocial), 54, issuerInfoY, 115, 171,
  );
  let emitterInfoY = issuerInfoY - Math.max(17, razonSocialLines.length * 10 + 7);
  const domicilioLines = drawLabeledWrappedValue(
    page, fonts, "Domicilio Comercial:", emitterCommercialAddress(emitter), 54, emitterInfoY, 139, 147,
  );
  emitterInfoY -= Math.max(17, domicilioLines.length * 10 + 7);
  drawLabeledWrappedValue(
    page, fonts, "Condición IVA:", emitterFiscalIvaLabel(emitter), 54, emitterInfoY, 119, 167,
  );

  page.drawRectangle({ x: 276, y: 744, width: 44, height: 54, color: WHITE, borderWidth: 0.8 });
  drawCentered(page, invoice.claseComprobante ?? "C", 298, 766, fonts.bold, 22);
  drawCentered(page, `COD. ${String(invoice.tipoComprobante).padStart(3, "0")}`, 298, 751, fonts.bold, 6.5);

  const documentLabel = isFceInvoice(invoice.tipoComprobante) ? "FACTURA DE CRÉDITO ELECTRÓNICA MiPyME" : (invoice.documentoTipo ?? "FACTURA") === "FACTURA"
    ? "FACTURA" : invoice.documentoTipo === "NOTA_CREDITO" ? "NOTA DE CRÉDITO" : "NOTA DE DÉBITO";
  page.drawText(documentLabel, { x: 330, y: 758, font: fonts.bold, size: isFceInvoice(invoice.tipoComprobante) ? 8 : (invoice.documentoTipo ?? "FACTURA") === "FACTURA" ? 18 : 12 });
  if (isFceInvoice(invoice.tipoComprobante)) {
    page.drawText(`MiPyME · Sistema ${invoice.fceSistema ?? "-"}`, { x: 330, y: 743, font: fonts.bold, size: 9 });
  }
  drawLabeledValue(page, fonts, "Punto de Venta:", String(invoice.puntoVenta).padStart(5, "0"), 330, 731, 414);
  drawLabeledValue(page, fonts, "Comp. Nro:", String(invoice.numeroComprobante).padStart(8, "0"), 330, 714, 414);
  drawLabeledValue(page, fonts, "Fecha de Emisión:", formatDate(invoice.fechaComprobante), 330, 697, 414);
  drawLabeledValue(page, fonts, "CUIT:", text(emitter.cuit), 330, 680, 414);
  const iibbLines = drawLabeledWrappedValue(page, fonts, "Ingresos Brutos:", text(emitter.ingresosBrutos) || "No informado", 330, 663, 414, 131);
  const iibbExtraHeight = Math.max(0, iibbLines.length - 1) * 10;
  drawLabeledValue(page, fonts, "Inicio de Act.:", formatDate(text(emitter.inicioActividades)), 330, 646 - iibbExtraHeight, 414);
  if (isFceInvoice(invoice.tipoComprobante)) {
    page.drawText(`CBU: ${invoice.fceCbu ?? "-"}`, { x: 330, y: 630 - iibbExtraHeight, font: fonts.regular, size: 8 });
  }

  let receiverTop = 574;
  if (invoice.concepto !== 1 || isFceInvoice(invoice.tipoComprobante)) {
    page.drawRectangle({ x: MARGIN, y: 542, width: CONTENT_WIDTH, height: 31, color: WHITE, borderWidth: 0.8 });
    if (invoice.concepto !== 1) {
      drawLabeledValue(page, fonts, "Período Facturado Desde:", formatDate(invoice.fechaServicioDesde), 50, 554, 164);
      drawLabeledValue(page, fonts, "Hasta:", formatDate(invoice.fechaServicioHasta), 252, 554, 284);
    }
    drawLabeledValue(page, fonts, "Fecha de Vto. para el pago:", formatDate(invoice.fechaVencimientoPago), invoice.concepto === 1 ? 50 : 365, 554, invoice.concepto === 1 ? 173 : 488);
    receiverTop = 527;
  }

  const receiverHeight = 65 + layout.receiverExtraHeight;
  const receiverBottom = receiverTop - receiverHeight;
  page.drawRectangle({ x: MARGIN, y: receiverBottom, width: CONTENT_WIDTH, height: receiverHeight, color: WHITE, borderWidth: 0.8 });
  const receiverDocumentType = number(receiver.tipoDocumento);
  const receiverDocumentLabel = TIPOS_DOCUMENTO_FISCAL.find((item) => item.id === receiverDocumentType)?.label ?? "Documento";
  if (receiverDocumentType === 99) {
    // ARCA uses DocNro 0 for an unidentified final consumer; it is not a buyer-provided document number.
    page.drawText(receiverDocumentLabel, { x: 50, y: receiverTop - 19, font: fonts.bold, size: 8 });
  } else {
    drawLabeledValue(page, fonts, `${receiverDocumentLabel}:`, text(receiver.numeroDocumento), 50, receiverTop - 19, 90);
  }
  page.drawText("Condición IVA:", { x: 298, y: receiverTop - 19, font: fonts.bold, size: 8 });
  layout.receiverIvaLines.forEach((line, index) => page.drawText(line, { x: 360, y: receiverTop - 19 - index * 10, font: fonts.regular, size: 8 }));
  const receiverNameY = receiverTop - 38 - layout.receiverIvaExtraHeight;
  const receiverNameLabel = "Apellido y Nombre / Razón Social:";
  const receiverNameValueX = 50 + fonts.bold.widthOfTextAtSize(receiverNameLabel, 8) + 8;
  page.drawText(receiverNameLabel, { x: 50, y: receiverNameY, font: fonts.bold, size: 8 });
  layout.receiverNameLines.forEach((line, index) => {
    page.drawText(line, {
      x: receiverNameValueX,
      y: receiverNameY - index * 10,
      font: fonts.regular,
      size: 8,
    });
  });
  const receiverDetailsY = receiverTop - 56 - layout.receiverNameExtraHeight - layout.receiverIvaExtraHeight;
  drawLabeledValue(page, fonts, "Condición de Venta:", invoice.condicionVenta || "Contado", 50, receiverDetailsY, 141);
  page.drawText("Domicilio:", { x: 298, y: receiverDetailsY, font: fonts.bold, size: 8 });
  layout.receiverAddressLines.forEach((line, index) => {
    page.drawText(line, {
      x: 352,
      y: receiverDetailsY - index * 10,
      font: fonts.regular,
      size: 8,
    });
  });
}

function drawContinuationHeader(page: PDFPage, invoice: FiscalPdfInvoice, fonts: Fonts, pageNumber: number) {
  const emitter = invoice.emisorSnapshot;
  page.drawText(text(emitter.nombreFantasia) || text(emitter.razonSocial), { x: MARGIN, y: 798, font: fonts.bold, size: 14 });
  const kind = isFceInvoice(invoice.tipoComprobante) ? "FCE MiPyME" : (invoice.documentoTipo ?? "FACTURA") === "FACTURA" ? "FACTURA"
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
      page.drawText(line || " ", { x: row.fullWidth ? 46 : 109, y: textY - index * 10, font: fonts.regular, size: 8 });
    });
    y -= row.height;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.35, color: rgb(0.82, 0.82, 0.82) });
  }
  return y;
}

function formatNumber(value: number): string {
  return formatNumberAr(value, { maxDecimals: 4 });
}

type FooterLayout = { top: number; words: string[]; legend: string[] };

function getFooterLayout(invoice: FiscalPdfInvoice, fonts: Fonts): FooterLayout {
  const fce = isFceInvoice(invoice.tipoComprobante);
  const words = fce ? wrapText(amountInPesosWords(invoice.total), fonts.bold, 8, CONTENT_WIDTH - 16) : [];
  const legend = fce ? wrapText(fceLegalLegend(invoice.fechaComprobante), fonts.regular, FCE_LEGEND_FONT_SIZE, CONTENT_WIDTH - 16) : [];
  // Legal text remains above the QR/CAE; totals and amount in words sit directly above it.
  const totalsHeight = ((invoice.claseComprobante ?? "C") === "C" ? 2 : 3) * 18 + 15;
  const top = fce
    ? FOOTER_SEPARATOR_Y + FCE_LEGEND_BOTTOM_GAP
      + (legend.length - 1) * FCE_LEGEND_LINE_HEIGHT
      + 12 + 10 + words.length * 11 + 22 + totalsHeight + 8
    : 244;
  return { top, words, legend };
}

function remitoRows(invoice: FiscalPdfInvoice, font: PDFFont): PrintableRow[] {
  if (!invoice.remitosAsociados?.length) return [];
  const references = [...new Set(invoice.remitosAsociados.map(({ clase, puntoEmision, numero }) => {
    if (!["R", "X"].includes(clase) || !Number.isInteger(puntoEmision) || puntoEmision < 1 || puntoEmision > 99998 || !Number.isInteger(numero) || numero < 1 || numero > 99999999) {
      throw new FacturacionValidationError("La referencia del remito asociado no es válida");
    }
    return `${clase} ${String(puntoEmision).padStart(5, "0")}-${String(numero).padStart(8, "0")}`;
  }))];
  const lines = wrapText(`Remitos asociados: ${references.join("; ")}`, font, 8, CONTENT_WIDTH - 16);
  const rows: PrintableRow[] = [];
  for (let offset = 0; offset < lines.length; offset += 28) {
    const descriptionLines = lines.slice(offset, offset + 28);
    rows.push({ codigo: null, descripcion: "", cantidad: 0, importeUnitario: 0, subtotal: 0, continuation: true, fullWidth: true, descriptionLines, height: Math.max(28, descriptionLines.length * 10 + 10) });
  }
  return rows;
}

async function drawFooter(
  pdf: PDFDocument,
  page: PDFPage,
  invoice: FiscalPdfInvoice,
  fonts: Fonts,
  layout: FooterLayout,
) {
  let y = layout.top - 8;
  const claseC = (invoice.claseComprobante ?? "C") === "C";
  const subtotal = invoice.totales
    ? invoice.totales.netoGravado + invoice.totales.noGravado + invoice.totales.exento
    : invoice.total;
  const totals = [
    [claseC ? "Subtotal:" : "Importe Neto:", claseC ? subtotal : invoice.totales?.netoGravado ?? invoice.total],
    ...(!claseC ? [["Importe IVA:", invoice.totales?.iva ?? 0]] : []),
    ["Otros Tributos:", invoice.totales?.tributos ?? 0],
  ] as [string, number][];
  for (const [label, value] of totals) {
    page.drawText(label, { x: 330, y, font: fonts.bold, size: 8 });
    drawRight(page, formatAmount(value), 557, y, fonts.regular, 8);
    y -= 18;
  }
  page.drawLine({ start: { x: 330, y: y + 4 }, end: { x: 557, y: y + 4 }, thickness: 0.8 });
  y -= 15;
  page.drawText("Importe Total:", { x: 330, y, font: fonts.bold, size: 11 });
  drawRight(page, formatAmount(invoice.total), 557, y, fonts.bold, 11);
  if (layout.words.length) {
    y -= 22;
    layout.words.forEach((line) => { page.drawText(line, { x: 46, y, font: fonts.bold, size: 8 }); y -= 11; });
    y -= 10;
    page.drawText("Régimen FCE - Ley 27.440", { x: 46, y, font: fonts.bold, size: FCE_LEGEND_FONT_SIZE });
    y -= 12;
    layout.legend.forEach((line) => { page.drawText(line, { x: 46, y, font: fonts.regular, size: FCE_LEGEND_FONT_SIZE }); y -= FCE_LEGEND_LINE_HEIGHT; });
  }
  page.drawLine({ start: { x: MARGIN, y: FOOTER_SEPARATOR_Y }, end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_SEPARATOR_Y }, thickness: 0.35, color: rgb(0.75, 0.75, 0.75) });

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
  if (isFceInvoice(invoice.tipoComprobante) && !hasFiscalIibb(invoice.emisorSnapshot.ingresosBrutos)) {
    throw new FacturacionValidationError("Completá la inscripción o condición en Ingresos Brutos en Configuración > Facturación para generar el PDF de la FCE");
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${invoice.documentoTipo ?? "FACTURA"} ${invoice.claseComprobante ?? "C"} ${invoice.puntoVenta}-${invoice.numeroComprobante}`);
  pdf.setSubject("Comprobante electrónico autorizado por ARCA");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const headerLayout = getFirstHeaderLayout(invoice, fonts);
  const firstTableY = firstTableStart(invoice, headerLayout.receiverExtraHeight);
  const footerLayout = getFooterLayout(invoice, fonts);
  const rows = [...printableRows(invoice.lineas, fonts.regular), ...remitoRows(invoice, fonts.regular)];
  const pages = paginate(rows, firstTableY, footerLayout.top);

  for (let index = 0; index < pages.length; index += 1) {
    const printablePage = pages[index];
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (printablePage.continuation) {
      drawContinuationHeader(page, invoice, fonts, index + 1);
    } else {
      drawFirstHeader(page, invoice, fonts, headerLayout);
    }
    const tableStart = printablePage.continuation ? 755 : firstTableY;
    drawTableHeader(page, tableStart, fonts);
    drawRows(page, printablePage.rows, tableStart, fonts);
    if (index === pages.length - 1) await drawFooter(pdf, page, invoice, fonts, footerLayout);
  }

  return pdf.save({ useObjectStreams: false });
}
