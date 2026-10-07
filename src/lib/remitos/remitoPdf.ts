import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { drawCentered, drawRight, formatDate, sanitizeForFont, text, wrapText } from "@/lib/pdf/pdfText";
import { REMITO_LEYENDA, formatRemitoCantidad, formatRemitoDocumento, type RemitoDetalle } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.35, 0.35, 0.35);
const HEADER_TOP = 798;
const HEADER_BOTTOM = 600;
const CONTINUATION_TABLE_TOP = 755;
const TABLE_HEADER_HEIGHT = 21;
const PAGE_BOTTOM_LIMIT = 48;
const ROW_FONT_SIZE = 8;

const COLUMNS = {
  codigo: { x: 46, width: 68 },
  descripcion: { x: 120, width: 215 },
  observaciones: { x: 343, width: 140 },
  cantidadRight: RIGHT_EDGE - 8,
} as const;

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type PrintableRow = {
  codigoLines: string[];
  descripcionLines: string[];
  observacionesLines: string[];
  cantidad: string;
  height: number;
};

type PrintablePage = {
  rows: PrintableRow[];
  /** Coordenada superior de la tabla; `null` si la página solo contiene el pie. */
  tableTop: number | null;
  continuation: boolean;
};

type FooterLayout = {
  observacionesLines: string[];
  imprentaLines: string[];
  rango: string | null;
  height: number;
};

function formatPunto(value: number) {
  return String(value).padStart(5, "0");
}

function formatNumeroInterno(value: number) {
  return String(value).padStart(8, "0");
}

function documentoDestinatario(remito: RemitoDetalle): string {
  return formatRemitoDocumento(remito.destinatario) ?? "Sin documento";
}

function inicioActividades(remito: RemitoDetalle): string | null {
  return (remito.clase === "R" ? remito.impresion?.inicioActividades : null) ?? remito.emisor.inicioActividades;
}

function drawLabeledValue(page: PDFPage, fonts: Fonts, label: string, value: string, x: number, y: number, valueX: number) {
  page.drawText(label, { x, y, font: fonts.bold, size: 8 });
  page.drawText(value || "-", { x: valueX, y, font: fonts.regular, size: 8 });
}

function drawLabeledWrappedValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  y: number,
  maxRight: number,
): number {
  page.drawText(label, { x, y, font: fonts.bold, size: 8 });
  const valueX = x + fonts.bold.widthOfTextAtSize(label, 8) + 6;
  const lines = wrapText(value || "-", fonts.regular, 8, maxRight - valueX);
  lines.forEach((line, index) => {
    page.drawText(line, { x: valueX, y: y - index * 10, font: fonts.regular, size: 8 });
  });
  return lines.length;
}

function wrappedLineCount(fonts: Fonts, label: string, value: string, x: number, maxRight: number): number {
  const valueX = x + fonts.bold.widthOfTextAtSize(label, 8) + 6;
  return wrapText(value || "-", fonts.regular, 8, maxRight - valueX).length;
}

/** Sanitiza todos los textos libres del remito para la fuente estándar (WinAnsi). */
function sanitizeRemito(remito: RemitoDetalle, font: PDFFont): RemitoDetalle {
  const clean = (value: string | null | undefined) => (value == null ? value ?? null : sanitizeForFont(value, font));
  return {
    ...remito,
    emisor: {
      ...remito.emisor,
      razonSocial: clean(remito.emisor.razonSocial) ?? "",
      nombreFantasia: clean(remito.emisor.nombreFantasia),
      domicilio: clean(remito.emisor.domicilio) ?? "",
      ingresosBrutos: clean(remito.emisor.ingresosBrutos),
    },
    destinatario: {
      ...remito.destinatario,
      nombre: clean(remito.destinatario.nombre) ?? "",
      domicilio: clean(remito.destinatario.domicilio),
      condicionIva: clean(remito.destinatario.condicionIva),
    },
    transportista: remito.transportista ? {
      nombre: clean(remito.transportista.nombre) ?? "",
      domicilio: clean(remito.transportista.domicilio),
      cuit: clean(remito.transportista.cuit),
    } : null,
    impresion: remito.impresion ? {
      ...remito.impresion,
      imprenta: remito.impresion.imprenta ? {
        ...remito.impresion.imprenta,
        razonSocial: clean(remito.impresion.imprenta.razonSocial) ?? "",
        habilitacion: clean(remito.impresion.imprenta.habilitacion) ?? "",
      } : null,
    } : null,
    observaciones: clean(remito.observaciones),
    factura: remito.factura ? { ...remito.factura, label: clean(remito.factura.label) ?? "" } : null,
    lineas: remito.lineas.map((linea) => ({
      ...linea,
      codigo: clean(linea.codigo),
      descripcion: clean(linea.descripcion) ?? "",
      observaciones: clean(linea.observaciones),
    })),
  };
}

function printableRows(remito: RemitoDetalle, font: PDFFont): PrintableRow[] {
  return remito.lineas.map((linea) => {
    const codigoLines = wrapText(linea.codigo || "-", font, ROW_FONT_SIZE, COLUMNS.codigo.width);
    const descripcionLines = wrapText(linea.descripcion || "-", font, ROW_FONT_SIZE, COLUMNS.descripcion.width);
    const observacionesLines = linea.observaciones
      ? wrapText(linea.observaciones, font, ROW_FONT_SIZE, COLUMNS.observaciones.width)
      : [];
    const lineCount = Math.max(codigoLines.length, descripcionLines.length, observacionesLines.length, 1);
    return {
      codigoLines,
      descripcionLines,
      observacionesLines,
      cantidad: formatRemitoCantidad(linea.cantidad),
      height: Math.max(24, lineCount * 10 + 12),
    };
  });
}

function destinatarioLayout(remito: RemitoDetalle, fonts: Fonts) {
  const nameLines = wrappedLineCount(fonts, "Apellido y Nombre / Razón Social:", remito.destinatario.nombre, 50, RIGHT_EDGE - 12);
  const addressLines = wrappedLineCount(fonts, "Domicilio:", remito.destinatario.domicilio ?? "-", 50, RIGHT_EDGE - 12);
  return { height: 70 + (nameLines - 1) * 10 + (addressLines - 1) * 10 };
}

const TRANSPORTISTA_NOMBRE_RIGHT = 370;

function transportistaLayout(remito: RemitoDetalle, fonts: Fonts) {
  if (!remito.transportista) return { height: 0 };
  const nameLines = wrappedLineCount(fonts, "Nombre / Razón Social:", remito.transportista.nombre, 50, TRANSPORTISTA_NOMBRE_RIGHT);
  const addressLines = wrappedLineCount(fonts, "Domicilio:", remito.transportista.domicilio ?? "-", 50, RIGHT_EDGE - 12);
  return { height: 54 + (nameLines - 1) * 10 + (addressLines - 1) * 10 };
}

function footerLayout(remito: RemitoDetalle, fonts: Fonts): FooterLayout {
  const observacionesLines = remito.observaciones
    ? wrapText(remito.observaciones, fonts.regular, 8, CONTENT_WIDTH - 24)
    : [];
  const imprenta = remito.clase === "R" ? remito.impresion?.imprenta : null;
  const imprentaLines = imprenta
    ? wrapText(
      `Imprenta: ${imprenta.razonSocial} – CUIT ${imprenta.cuit} – Hab. N° ${imprenta.habilitacion} – F. Imp.: ${formatDate(imprenta.fechaImpresion)}`,
      fonts.regular,
      7.5,
      CONTENT_WIDTH,
    )
    : [];
  const desde = remito.impresion?.numeroDesde ?? null;
  const hasta = remito.impresion?.numeroHasta ?? null;
  const rango = remito.clase === "R" && desde !== null && hasta !== null
    ? `Numeración del ${formatPunto(remito.puntoEmision)}-${formatNumeroInterno(desde)} al ${formatPunto(remito.puntoEmision)}-${formatNumeroInterno(hasta)}`
    : null;

  const observacionesHeight = observacionesLines.length ? 18 + observacionesLines.length * 10 : 0;
  const recibiHeight = 78;
  const caiHeight = remito.clase === "R" ? 32 + (rango ? 12 : 0) + imprentaLines.length * 10 : 0;
  const generadoHeight = 16;
  return {
    observacionesLines,
    imprentaLines,
    rango,
    height: observacionesHeight + recibiHeight + caiHeight + generadoHeight + 12,
  };
}

function paginate(rows: PrintableRow[], firstTableTop: number, footerTop: number): PrintablePage[] {
  const pages: PrintablePage[] = [{ rows: [], tableTop: firstTableTop, continuation: false }];
  let y = firstTableTop - TABLE_HEADER_HEIGHT;
  for (const row of rows) {
    const current = pages[pages.length - 1];
    if (y - row.height < PAGE_BOTTOM_LIMIT && current.rows.length > 0) {
      pages.push({ rows: [], tableTop: CONTINUATION_TABLE_TOP, continuation: true });
      y = CONTINUATION_TABLE_TOP - TABLE_HEADER_HEIGHT;
    }
    pages[pages.length - 1].rows.push(row);
    y -= row.height;
  }

  if (y >= footerTop) return pages;

  // El pie no entra debajo de la tabla: se mueven las últimas filas a una página nueva.
  const last = pages[pages.length - 1];
  const moved: PrintableRow[] = [];
  let bottom = y;
  while (last.rows.length > 1 && bottom < footerTop) {
    const row = last.rows.pop() as PrintableRow;
    moved.unshift(row);
    bottom += row.height;
  }
  const movedHeight = moved.reduce((sum, row) => sum + row.height, 0);
  if (moved.length > 0 && bottom >= footerTop
    && CONTINUATION_TABLE_TOP - TABLE_HEADER_HEIGHT - movedHeight >= footerTop) {
    pages.push({ rows: moved, tableTop: CONTINUATION_TABLE_TOP, continuation: true });
    return pages;
  }
  last.rows.push(...moved);
  pages.push({ rows: [], tableTop: null, continuation: true });
  return pages;
}

function drawFirstHeader(page: PDFPage, remito: RemitoDetalle, fonts: Fonts) {
  const emisor = remito.emisor;
  page.drawRectangle({
    x: MARGIN, y: HEADER_BOTTOM, width: CONTENT_WIDTH, height: HEADER_TOP - HEADER_BOTTOM, color: WHITE, borderWidth: 0.8,
  });
  page.drawLine({ start: { x: 298, y: HEADER_BOTTOM }, end: { x: 298, y: HEADER_TOP }, thickness: 0.8 });

  const issuerName = text(emisor.nombreFantasia) || text(emisor.razonSocial);
  const issuerNameLines = wrapText(issuerName, fonts.bold, 14, 210).slice(0, 3);
  issuerNameLines.forEach((line, index) => {
    drawCentered(page, line, 168, 772 - index * 15, fonts.bold, 14);
  });
  let leftY = Math.min(716, 772 - (issuerNameLines.length - 1) * 15 - 24);
  const razonSocialLines = drawLabeledWrappedValue(page, fonts, "Razón Social:", text(emisor.razonSocial), 54, leftY, 286);
  leftY -= Math.max(17, razonSocialLines * 10 + 7);
  const domicilioLines = drawLabeledWrappedValue(page, fonts, "Domicilio Comercial:", text(emisor.domicilio), 54, leftY, 286);
  leftY -= Math.max(17, domicilioLines * 10 + 7);
  drawLabeledWrappedValue(page, fonts, "Condición IVA:", text(emisor.condicionIva) || "-", 54, leftY, 286);

  page.drawRectangle({ x: 276, y: 744, width: 44, height: 54, color: WHITE, borderWidth: 0.8 });
  drawCentered(page, remito.clase, 298, 766, fonts.bold, 22);
  if (remito.clase === "R") {
    drawCentered(page, `COD. ${String(remito.tipoComprobante ?? 91).padStart(3, "0")}`, 298, 751, fonts.bold, 6.5);
  }

  page.drawText("REMITO", { x: 330, y: 760, font: fonts.bold, size: 18 });
  page.drawText(REMITO_LEYENDA, { x: 330, y: 744, font: fonts.bold, size: 8 });
  drawLabeledValue(page, fonts, "Punto de Emisión:", formatPunto(remito.puntoEmision), 330, 724, 418);
  drawLabeledValue(page, fonts, "Remito N°:", formatNumeroInterno(remito.numero), 330, 708, 418);
  drawLabeledValue(page, fonts, "Fecha de Emisión:", formatDate(remito.fechaEmision), 330, 692, 418);
  drawLabeledValue(page, fonts, "CUIT:", text(emisor.cuit), 330, 676, 418);
  drawLabeledValue(page, fonts, "Ingresos Brutos:", text(emisor.ingresosBrutos) || "-", 330, 660, 418);
  drawLabeledValue(page, fonts, "Inicio de Act.:", formatDate(inicioActividades(remito)), 330, 644, 418);
}

function drawDestinatario(page: PDFPage, remito: RemitoDetalle, fonts: Fonts, top: number, height: number) {
  const destinatario = remito.destinatario;
  page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, color: WHITE, borderWidth: 0.8 });
  page.drawText("DESTINATARIO", { x: 50, y: top - 14, font: fonts.bold, size: 7.5, color: MUTED });
  let y = top - 30;
  const nameLines = drawLabeledWrappedValue(
    page, fonts, "Apellido y Nombre / Razón Social:", destinatario.nombre, 50, y, RIGHT_EDGE - 12,
  );
  y -= 16 + (nameLines - 1) * 10;
  drawLabeledValue(page, fonts, "CUIT/Documento:", documentoDestinatario(remito), 50, y, 124);
  drawLabeledValue(page, fonts, "Condición IVA:", text(destinatario.condicionIva) || "-", 298, y, 360);
  y -= 16;
  drawLabeledWrappedValue(page, fonts, "Domicilio:", destinatario.domicilio ?? "-", 50, y, RIGHT_EDGE - 12);
}

function drawTransportista(page: PDFPage, remito: RemitoDetalle, fonts: Fonts, top: number, height: number) {
  const transportista = remito.transportista;
  if (!transportista) return;
  page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, color: WHITE, borderWidth: 0.8 });
  page.drawText("TRANSPORTISTA", { x: 50, y: top - 14, font: fonts.bold, size: 7.5, color: MUTED });
  const y = top - 30;
  const nameLines = drawLabeledWrappedValue(
    page, fonts, "Nombre / Razón Social:", transportista.nombre, 50, y, TRANSPORTISTA_NOMBRE_RIGHT,
  );
  drawLabeledValue(page, fonts, "CUIT:", transportista.cuit ?? "-", 380, y, 410);
  drawLabeledWrappedValue(page, fonts, "Domicilio:", transportista.domicilio ?? "-", 50, y - 16 - (nameLines - 1) * 10, RIGHT_EDGE - 12);
}

function drawContinuationHeader(page: PDFPage, remito: RemitoDetalle, fonts: Fonts) {
  const emisor = remito.emisor;
  const issuer = wrapText(text(emisor.nombreFantasia) || text(emisor.razonSocial), fonts.bold, 14, 300)[0];
  page.drawText(issuer, { x: MARGIN, y: 798, font: fonts.bold, size: 14 });
  drawRight(page, `REMITO ${remito.numeroVisible}`, RIGHT_EDGE, 798, fonts.bold, 11);
  drawRight(page, REMITO_LEYENDA, RIGHT_EDGE, 784, fonts.regular, 7);
  page.drawLine({ start: { x: MARGIN, y: 775 }, end: { x: RIGHT_EDGE, y: 775 }, thickness: 0.8 });
}

function drawTableHeader(page: PDFPage, top: number, fonts: Fonts) {
  page.drawRectangle({ x: MARGIN, y: top - TABLE_HEADER_HEIGHT, width: CONTENT_WIDTH, height: TABLE_HEADER_HEIGHT, color: rgb(0.18, 0.18, 0.18) });
  const y = top - 14;
  page.drawText("CÓDIGO", { x: COLUMNS.codigo.x, y, font: fonts.bold, size: 7.5, color: WHITE });
  page.drawText("ARTÍCULO / DESCRIPCIÓN", { x: COLUMNS.descripcion.x, y, font: fonts.bold, size: 7.5, color: WHITE });
  page.drawText("OBSERVACIONES", { x: COLUMNS.observaciones.x, y, font: fonts.bold, size: 7.5, color: WHITE });
  const label = "CANTIDAD";
  page.drawText(label, {
    x: COLUMNS.cantidadRight - fonts.bold.widthOfTextAtSize(label, 7.5), y, font: fonts.bold, size: 7.5, color: WHITE,
  });
}

function drawRows(page: PDFPage, rows: PrintableRow[], top: number, fonts: Fonts) {
  let y = top - TABLE_HEADER_HEIGHT;
  for (const row of rows) {
    const textY = y - 15;
    const drawLines = (lines: string[], x: number) => lines.forEach((line, index) => {
      page.drawText(line || " ", { x, y: textY - index * 10, font: fonts.regular, size: ROW_FONT_SIZE });
    });
    drawLines(row.codigoLines, COLUMNS.codigo.x);
    drawLines(row.descripcionLines, COLUMNS.descripcion.x);
    drawLines(row.observacionesLines, COLUMNS.observaciones.x);
    drawRight(page, row.cantidad, COLUMNS.cantidadRight, textY, fonts.regular, ROW_FONT_SIZE);
    y -= row.height;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT_EDGE, y }, thickness: 0.35, color: rgb(0.82, 0.82, 0.82) });
  }
}

function drawFooter(page: PDFPage, remito: RemitoDetalle, fonts: Fonts, layout: FooterLayout, footerTop: number) {
  let y = footerTop - 6;

  if (layout.observacionesLines.length) {
    page.drawText("Observaciones:", { x: MARGIN, y: y - 8, font: fonts.bold, size: 8 });
    layout.observacionesLines.forEach((line, index) => {
      page.drawText(line || " ", { x: MARGIN + 12, y: y - 22 - index * 10, font: fonts.regular, size: 8 });
    });
    y -= 18 + layout.observacionesLines.length * 10;
  }

  const boxTop = y - 4;
  page.drawRectangle({ x: MARGIN, y: boxTop - 70, width: CONTENT_WIDTH, height: 70, color: WHITE, borderWidth: 0.8 });
  page.drawText("Recibí conforme", { x: 50, y: boxTop - 16, font: fonts.bold, size: 9 });
  const signatureY = boxTop - 50;
  page.drawLine({ start: { x: 60, y: signatureY }, end: { x: 270, y: signatureY }, thickness: 0.6 });
  page.drawLine({ start: { x: 320, y: signatureY }, end: { x: 530, y: signatureY }, thickness: 0.6 });
  drawCentered(page, "Firma", 165, signatureY - 11, fonts.regular, 8);
  drawCentered(page, "Aclaración", 425, signatureY - 11, fonts.regular, 8);
  y = boxTop - 78;

  if (remito.clase === "R") {
    drawRight(page, `CAI N°: ${remito.cai ?? "-"}`, RIGHT_EDGE, y - 10, fonts.bold, 10);
    drawRight(page, `Fecha de Vto.: ${formatDate(remito.caiVencimiento)}`, RIGHT_EDGE, y - 24, fonts.bold, 9);
    y -= 32;
    if (layout.rango) {
      drawRight(page, layout.rango, RIGHT_EDGE, y - 8, fonts.regular, 8);
      y -= 12;
    }
    layout.imprentaLines.forEach((line, index) => {
      drawRight(page, line, RIGHT_EDGE, y - 8 - index * 10, fonts.regular, 7.5);
    });
    y -= layout.imprentaLines.length * 10;
  }

  drawRight(page, "Generado por B2Car", RIGHT_EDGE, Math.min(y - 10, 40), fonts.regular, 7);
}

/** Genera el PDF del remito a partir de sus snapshots. No incluye importes ni consulta datos vivos. */
export async function generateRemitoPdf(detalle: RemitoDetalle): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Remito ${detalle.numeroVisible}`);
  pdf.setSubject(`Remito - ${REMITO_LEYENDA}`);
  pdf.setProducer("B2Car");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const remito = sanitizeRemito(detalle, fonts.regular);

  let firstTableTop = HEADER_BOTTOM - 14;
  const facturaY = firstTableTop;
  if (remito.factura) firstTableTop -= 18;
  const destinatarioTop = firstTableTop;
  const destinatario = destinatarioLayout(remito, fonts);
  firstTableTop -= destinatario.height + 10;
  const transportistaTop = firstTableTop;
  const transportista = transportistaLayout(remito, fonts);
  if (transportista.height) firstTableTop -= transportista.height + 10;

  const footer = footerLayout(remito, fonts);
  const footerTop = 30 + footer.height;
  const pages = paginate(printableRows(remito, fonts.regular), firstTableTop, footerTop);

  pages.forEach((printablePage, index) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (printablePage.continuation) {
      drawContinuationHeader(page, remito, fonts);
    } else {
      drawFirstHeader(page, remito, fonts);
      if (remito.factura) {
        drawLabeledValue(page, fonts, "Factura asociada:", remito.factura.label, MARGIN, facturaY - 4, MARGIN + 76);
      }
      drawDestinatario(page, remito, fonts, destinatarioTop, destinatario.height);
      drawTransportista(page, remito, fonts, transportistaTop, transportista.height);
    }
    if (printablePage.tableTop !== null) {
      drawTableHeader(page, printablePage.tableTop, fonts);
      drawRows(page, printablePage.rows, printablePage.tableTop, fonts);
    }
    if (index === pages.length - 1) drawFooter(page, remito, fonts, footer, footerTop);
    if (pages.length > 1) {
      drawCentered(page, `Página ${index + 1} de ${pages.length}`, PAGE_WIDTH / 2, 22, fonts.regular, 7.5);
    }
  });

  return pdf.save({ useObjectStreams: false });
}

/** Nombre de archivo del PDF: `remito-r-00001-00000008.pdf`. */
export function remitoPdfFilename(remito: Pick<RemitoDetalle, "clase" | "puntoEmision" | "numero">): string {
  return `remito-${remito.clase.toLowerCase()}-${formatPunto(remito.puntoEmision)}-${formatNumeroInterno(remito.numero)}.pdf`;
}
