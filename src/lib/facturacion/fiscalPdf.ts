import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { drawCentered, drawRight, formatDate, text, wrapText } from "@/lib/pdf/pdfText";
import { formatArs, formatNumberAr } from "../format";
import { FacturacionValidationError } from "./arcaPayload";
import { precioUnitarioMostrado } from "./lineaImporte";
import {
  amountInPesosWords, emitterCommercialAddress, emitterFiscalIvaLabel,
  fceLegalLegend, hasFiscalIibb, isFceInvoice, receiverFiscalIvaLabel,
} from "./fiscalPresentation";
import {
  ALICUOTAS_IVA_ARCA,
  TIPOS_DOCUMENTO_FISCAL,
  type DocumentoFiscalClase,
  type FacturaClase,
  type FacturaTotales,
  type TratamientoIva,
} from "./types";

const ARCA_QR_URL = "https://www.arca.gob.ar/fe/qr/?p=";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const WHITE = rgb(1, 1, 1);
const FOOTER_SEPARATOR_Y = 150;
const CONTINUATION_TABLE_TOP = 755;
/** Tope del pie cuando no entra debajo de la última fila y pasa a la parte superior de una hoja nueva. */
const FOOTER_TOP_ON_OWN_PAGE = 763;
const ROW_TEXT_OFFSET = 13;

function rowHeight(lines: number): number {
  return Math.max(20, lines * 10 + 10);
}
const FCE_LEGEND_FONT_SIZE = 7;
const FCE_LEGEND_LINE_HEIGHT = 9;
const FCE_LEGEND_BOTTOM_GAP = 10;
const ASSOCIATED_LABEL = "Comprobante asociado:";
const TRANSPARENCY_TITLE = "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)";
export const FISCAL_PDF_DRAFT_MARK = "BORRADOR — SIN VALIDEZ FISCAL — NO EMITIDO";
const DRAFT_PENDING = "Pendiente";
const DRAFT_COLOR = rgb(0.7, 0.12, 0.12);

type FiscalRecord = Record<string, unknown>;

export type FiscalPdfLine = {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  importeUnitario: number;
  subtotal: number;
  importeTotal?: number;
  /** Tratamiento y alícuota de IVA de la línea: permiten rotular el IVA del pie con su porcentaje. */
  tratamientoIva?: TratamientoIva;
  ivaAlicuota?: number;
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
  /** Factura a la que refiere una nota de crédito o débito (CbtesAsoc). */
  comprobanteAsociado?: { tipoComprobante: number; clase: FacturaClase; puntoVenta: number; numero: number; fecha: string } | null;
};

/** Contenido revisado antes de emitir: todavía no tiene número, CAE ni QR. */
export type FiscalPdfDraft = Omit<FiscalPdfInvoice, "id" | "numeroComprobante" | "cae" | "caeVencimiento">;

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
  unitarioMaxDecimales?: number;
};

type PrintablePage = {
  rows: PrintableRow[];
  continuation: boolean;
  /** Sólo la última hoja lleva el pie: abajo si entra después de las filas, o arriba en una hoja propia. */
  footer: "bottom" | "top" | null;
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
  return formatArs(value, { minDecimals: 2, maxDecimals: 2 });
}

export function fiscalPdfUnitPrice(line: FiscalPdfLine): { value: number; maxDecimals: number } {
  return precioUnitarioMostrado(line, line.importeTotal ?? line.subtotal);
}

function printableRows(lines: FiscalPdfLine[], font: PDFFont): PrintableRow[] {
  const output: PrintableRow[] = [];
  for (const line of lines) {
    const unitPrice = fiscalPdfUnitPrice(line);
    const wrapped = wrapText(line.descripcion || "-", font, 8, 230);
    for (let offset = 0; offset < wrapped.length; offset += 28) {
      const descriptionLines = wrapped.slice(offset, offset + 28);
      output.push({
        ...line,
        codigo: offset === 0 ? line.codigo : null,
        cantidad: offset === 0 ? line.cantidad : 0,
        importeUnitario: offset === 0 ? unitPrice.value : 0,
        unitarioMaxDecimales: offset === 0 ? unitPrice.maxDecimals : 2,
        subtotal: offset === 0 ? (line.importeTotal ?? line.subtotal) : 0,
        descriptionLines,
        continuation: offset > 0,
        height: rowHeight(descriptionLines.length),
      });
    }
  }
  return output;
}

function firstTableStart(invoice: FiscalPdfDraft, receiverExtraHeight = 0): number {
  return (invoice.concepto === 1 && !isFceInvoice(invoice.tipoComprobante) ? 493 : 462) - receiverExtraHeight;
}

function paginate(rows: PrintableRow[], firstTableY: number, footerTop: number): PrintablePage[] {
  const pages: PrintablePage[] = [{ rows: [], continuation: false, footer: null }];
  let remaining = firstTableY - 21 - 38;
  for (const row of rows) {
    if (row.height > remaining) {
      pages.push({ rows: [], continuation: true, footer: null });
      remaining = CONTINUATION_TABLE_TOP - 21 - 38;
    }
    pages[pages.length - 1].rows.push(row);
    remaining -= row.height;
  }

  // Las filas nunca se mueven para hacerle lugar al pie: si no entra debajo de la
  // última fila, el pie (totales, QR y CAE) sigue arriba de una hoja nueva.
  const last = pages[pages.length - 1];
  const used = last.rows.reduce((sum, row) => sum + row.height, 0);
  const tableTop = last.continuation ? CONTINUATION_TABLE_TOP : firstTableY;
  if (tableTop - 21 - used - 15 >= footerTop) {
    last.footer = "bottom";
  } else {
    pages.push({ rows: [], continuation: true, footer: "top" });
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
  associatedLines: string[];
  associatedValueX: number;
};

function associatedReference(invoice: FiscalPdfDraft): string | null {
  const associated = invoice.comprobanteAsociado;
  if (!associated || (invoice.documentoTipo ?? "FACTURA") === "FACTURA") return null;
  const kind = isFceInvoice(associated.tipoComprobante) ? "Factura de Crédito Electrónica MiPyME" : "Factura";
  const number = `${String(associated.puntoVenta).padStart(5, "0")}-${String(associated.numero).padStart(8, "0")}`;
  return `${kind} ${associated.clase} ${number} del ${formatDate(associated.fecha)}`;
}

function getFirstHeaderLayout(invoice: FiscalPdfDraft, fonts: Fonts): FirstHeaderLayout {
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
  const reference = associatedReference(invoice);
  const associatedValueX = 50 + fonts.bold.widthOfTextAtSize(ASSOCIATED_LABEL, 8) + 8;
  const associatedLines = reference ? wrapText(reference, fonts.regular, 8, rightEdge - associatedValueX) : [];
  const associatedExtraHeight = associatedLines.length ? 8 + associatedLines.length * 10 : 0;
  return {
    receiverNameLines,
    receiverNameExtraHeight,
    receiverAddressLines,
    receiverExtraHeight: receiverNameExtraHeight + receiverAddressExtraHeight + receiverIvaExtraHeight + associatedExtraHeight,
    receiverIvaLines,
    receiverIvaExtraHeight,
    associatedLines,
    associatedValueX,
  };
}

/** Número definitivo del comprobante; en un borrador todavía no existe y se informa pendiente. */
function voucherNumberLabel(authorization: FiscalPdfInvoice | null): string {
  return authorization ? String(authorization.numeroComprobante).padStart(8, "0") : DRAFT_PENDING;
}

function drawFirstHeader(
  page: PDFPage,
  invoice: FiscalPdfDraft,
  fonts: Fonts,
  layout: FirstHeaderLayout,
  authorization: FiscalPdfInvoice | null,
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
  drawLabeledValue(page, fonts, "Comp. Nro:", voucherNumberLabel(authorization), 330, 714, 414);
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
  if (layout.associatedLines.length) {
    const associatedY = receiverDetailsY - layout.receiverAddressLines.length * 10 - 8;
    page.drawText(ASSOCIATED_LABEL, { x: 50, y: associatedY, font: fonts.bold, size: 8 });
    layout.associatedLines.forEach((line, index) => {
      page.drawText(line, { x: layout.associatedValueX, y: associatedY - index * 10, font: fonts.regular, size: 8 });
    });
  }
}

function drawContinuationHeader(
  page: PDFPage,
  invoice: FiscalPdfDraft,
  fonts: Fonts,
  pageNumber: number,
  authorization: FiscalPdfInvoice | null,
) {
  const emitter = invoice.emisorSnapshot;
  page.drawText(text(emitter.nombreFantasia) || text(emitter.razonSocial), { x: MARGIN, y: 798, font: fonts.bold, size: 14 });
  const kind = isFceInvoice(invoice.tipoComprobante) ? "FCE MiPyME" : (invoice.documentoTipo ?? "FACTURA") === "FACTURA" ? "FACTURA"
    : invoice.documentoTipo === "NOTA_CREDITO" ? "NC" : "ND";
  const label = `${kind} ${invoice.claseComprobante ?? "C"} ${String(invoice.puntoVenta).padStart(5, "0")}-${voucherNumberLabel(authorization)}`;
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
    const textY = y - ROW_TEXT_OFFSET;
    if (!row.continuation) {
      page.drawText(row.codigo || "-", { x: 46, y: textY, font: fonts.regular, size: 8 });
      drawCentered(page, formatNumber(row.cantidad), 383, textY, fonts.regular, 8);
      drawRight(page, formatArs(row.importeUnitario, { minDecimals: 2, maxDecimals: row.unitarioMaxDecimales ?? 2 }), 482, textY, fonts.regular, 8);
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

function getFooterLayout(invoice: FiscalPdfDraft, fonts: Fonts): FooterLayout {
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

/**
 * Rótulo del IVA discriminado del pie. En clase A lleva el porcentaje ("Importe IVA 21%:")
 * cuando todas las líneas gravadas comparten una misma alícuota; si hay varias, o no se
 * conoce, queda sin porcentaje porque el total mezcla alícuotas distintas.
 */
function ivaTotalLabel(invoice: FiscalPdfDraft): string {
  const generic = "Importe IVA:";
  if (invoice.claseComprobante !== "A") return generic;
  const rates = new Set(
    invoice.lineas
      .filter((line) => line.tratamientoIva === "GRAVADO" && line.ivaAlicuota != null)
      .map((line) => line.ivaAlicuota as number),
  );
  if (rates.size !== 1) return generic;
  const [rate] = rates;
  const label = ALICUOTAS_IVA_ARCA.find((item) => item.porcentaje === rate)?.label ?? `${formatNumberAr(rate, { maxDecimals: 2 })}%`;
  return `Importe IVA ${label}:`;
}

function remitoRows(invoice: FiscalPdfDraft, font: PDFFont): PrintableRow[] {
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
    rows.push({ codigo: null, descripcion: "", cantidad: 0, importeUnitario: 0, subtotal: 0, continuation: true, fullWidth: true, descriptionLines, height: rowHeight(descriptionLines.length) });
  }
  return rows;
}

/**
 * RG 5614/2024 (RG 1415, Anexo II, ap. B, inc. g): los comprobantes clase B de un
 * responsable inscripto informan, abajo a la izquierda, el IVA contenido y los otros
 * impuestos nacionales indirectos (impuestos internos), no los "Otros Tributos".
 * Clase A discrimina IVA para un receptor inscripto y clase C (monotributo) no
 * discrimina IVA, así que ninguna de las dos lleva el bloque.
 */
function transparencyRows(invoice: FiscalPdfDraft): [string, number][] | null {
  if (invoice.claseComprobante !== "B" || !invoice.totales) return null;
  return [
    ["IVA Contenido:", invoice.totales.iva],
    ["Otros Impuestos Nacionales Indirectos:", invoice.totales.otrosImpuestosNacionales],
  ];
}

function drawTransparencyBlock(page: PDFPage, invoice: FiscalPdfDraft, fonts: Fonts, top: number) {
  const rows = transparencyRows(invoice);
  if (!rows) return;
  let y = top;
  for (const line of wrapText(TRANSPARENCY_TITLE, fonts.bold, 8, 270)) {
    page.drawText(line, { x: 46, y, font: fonts.bold, size: 8 });
    y -= 11;
  }
  y -= 3;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 46, y, font: fonts.regular, size: 8 });
    drawRight(page, formatAmount(value), 310, y, fonts.regular, 8);
    y -= 13;
  }
}

async function drawFooter(
  pdf: PDFDocument,
  page: PDFPage,
  invoice: FiscalPdfDraft,
  authorization: FiscalPdfInvoice | null,
  fonts: Fonts,
  layout: FooterLayout,
  /** Desplazamiento vertical: 0 al pie de la hoja, o lo necesario para dibujarlo arriba de una hoja propia. */
  shift = 0,
) {
  let y = layout.top - 8 + shift;
  // Ocupa la columna izquierda a la altura de los totales: no compite con ellos ni con el QR y el CAE.
  drawTransparencyBlock(page, invoice, fonts, y);
  const claseC = (invoice.claseComprobante ?? "C") === "C";
  const subtotal = invoice.totales
    ? invoice.totales.netoGravado + invoice.totales.noGravado + invoice.totales.exento
    : invoice.total;
  const totals = [
    [claseC ? "Subtotal:" : "Importe Neto:", claseC ? subtotal : invoice.totales?.netoGravado ?? invoice.total],
    ...(!claseC ? [[ivaTotalLabel(invoice), invoice.totales?.iva ?? 0]] : []),
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
  const separatorY = FOOTER_SEPARATOR_Y + shift;
  page.drawLine({ start: { x: MARGIN, y: separatorY }, end: { x: PAGE_WIDTH - MARGIN, y: separatorY }, thickness: 0.35, color: rgb(0.75, 0.75, 0.75) });

  if (authorization) {
    const qrBytes = await QRCode.toBuffer(buildArcaQrUrl(authorization), {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 0,
      width: 300,
    });
    const qr = await pdf.embedPng(Uint8Array.from(qrBytes));
    page.drawImage(qr, { x: 42, y: 28 + shift, width: 112, height: 112 });
    drawRight(page, `CAE N°: ${authorization.cae}`, 557, 91 + shift, fonts.bold, 10);
    drawRight(page, `Fecha de Vto. de CAE: ${formatDate(authorization.caeVencimiento)}`, 557, 73 + shift, fonts.bold, 9);
    drawRight(page, "Comprobante autorizado por ARCA", 557, 52 + shift, fonts.regular, 8);
  } else {
    // Sin autorización no existen QR ni CAE: se informan pendientes, nunca se inventan.
    page.drawRectangle({ x: 42, y: 28 + shift, width: 112, height: 112, borderWidth: 0.8, borderColor: rgb(0.7, 0.7, 0.7) });
    drawCentered(page, "QR disponible", 98, 88 + shift, fonts.regular, 8);
    drawCentered(page, "al autorizar", 98, 77 + shift, fonts.regular, 8);
    drawRight(page, `CAE N°: ${DRAFT_PENDING}`, 557, 91 + shift, fonts.bold, 10);
    drawRight(page, `Fecha de Vto. de CAE: ${DRAFT_PENDING}`, 557, 73 + shift, fonts.bold, 9);
    drawRight(page, "Borrador sin validez fiscal: no fue autorizado por ARCA", 557, 52 + shift, fonts.regular, 8);
  }
  drawRight(page, "Generado por B2Car", 557, 38 + shift, fonts.regular, 7);
}

/** Marca de borrador sobre todo el contenido de cada hoja. */
function drawDraftMark(page: PDFPage, fonts: Fonts) {
  const bannerWidth = fonts.bold.widthOfTextAtSize(FISCAL_PDF_DRAFT_MARK, 10);
  page.drawText(FISCAL_PDF_DRAFT_MARK, {
    x: (PAGE_WIDTH - bannerWidth) / 2, y: 822, font: fonts.bold, size: 10, color: DRAFT_COLOR,
  });
  const angle = 38;
  const radians = (angle * Math.PI) / 180;
  const diagonal = [
    { value: "BORRADOR", size: 92, offset: 0 },
    { value: "SIN VALIDEZ FISCAL — NO EMITIDO", size: 22, offset: -44 },
  ];
  for (const { value, size, offset } of diagonal) {
    const width = fonts.bold.widthOfTextAtSize(value, size);
    // Centra cada renglón rotado en la hoja; el segundo va desplazado debajo del primero.
    const centerX = PAGE_WIDTH / 2 + Math.sin(radians) * -offset;
    const centerY = PAGE_HEIGHT / 2 + Math.cos(radians) * offset;
    page.drawText(value, {
      x: centerX - (width / 2) * Math.cos(radians),
      y: centerY - (width / 2) * Math.sin(radians),
      font: fonts.bold, size, color: DRAFT_COLOR, opacity: 0.16, rotate: degrees(angle),
    });
  }
}

export async function generateFiscalInvoicePdf(invoice: FiscalPdfInvoice): Promise<Uint8Array> {
  if (isFceInvoice(invoice.tipoComprobante) && !hasFiscalIibb(invoice.emisorSnapshot.ingresosBrutos)) {
    throw new FacturacionValidationError("Completá la inscripción o condición en Ingresos Brutos en Configuración > Facturación para generar el PDF de la FCE");
  }
  return renderFiscalPdf(invoice, invoice);
}

/**
 * Vista previa con la misma maquetación y paginación del comprobante autorizado:
 * número, CAE y QR quedan pendientes y todas las hojas llevan la marca de borrador.
 */
export async function generateFiscalDraftPdf(draft: FiscalPdfDraft): Promise<Uint8Array> {
  return renderFiscalPdf(draft, null);
}

async function renderFiscalPdf(invoice: FiscalPdfDraft, authorization: FiscalPdfInvoice | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const voucher = `${invoice.documentoTipo ?? "FACTURA"} ${invoice.claseComprobante ?? "C"} ${invoice.puntoVenta}`;
  if (authorization) {
    pdf.setTitle(`${voucher}-${authorization.numeroComprobante}`);
    pdf.setSubject("Comprobante electrónico autorizado por ARCA");
  } else {
    pdf.setTitle(`${FISCAL_PDF_DRAFT_MARK} · ${voucher}`);
    pdf.setSubject("Borrador sin validez fiscal: no fue emitido ni autorizado por ARCA");
    pdf.setKeywords(["BORRADOR", "SIN VALIDEZ FISCAL", "NO EMITIDO"]);
  }
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
      drawContinuationHeader(page, invoice, fonts, index + 1, authorization);
    } else {
      drawFirstHeader(page, invoice, fonts, headerLayout, authorization);
    }
    const tableStart = printablePage.continuation ? CONTINUATION_TABLE_TOP : firstTableY;
    // Una hoja que sólo continúa el pie no repite el encabezado de la tabla.
    if (printablePage.rows.length || !printablePage.continuation) {
      drawTableHeader(page, tableStart, fonts);
      drawRows(page, printablePage.rows, tableStart, fonts);
    }
    if (printablePage.footer === "bottom") await drawFooter(pdf, page, invoice, authorization, fonts, footerLayout);
    if (printablePage.footer === "top") await drawFooter(pdf, page, invoice, authorization, fonts, footerLayout, FOOTER_TOP_ON_OWN_PAGE - footerLayout.top);
    if (!authorization) drawDraftMark(page, fonts);
  }

  return pdf.save({ useObjectStreams: false });
}
