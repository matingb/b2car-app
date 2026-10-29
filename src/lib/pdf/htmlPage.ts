import { ColorTypes, type Color, type PDFPage } from "pdf-lib";

/**
 * Hoja que registra lo que se dibuja y lo devuelve como SVG, en puntos y con el mismo
 * sistema de coordenadas que pdf-lib (origen abajo a la izquierda). Comparte firma con
 * `PDFPage`, así el mismo código de layout puede componer un PDF o su vista HTML.
 */
export type HtmlPage = Pick<PDFPage, "drawText" | "drawRectangle" | "drawLine"> & {
  /** Imagen ya resuelta (por ejemplo un `data:` URI), con la esquina inferior izquierda en x, y. */
  drawImage(href: string, box: { x: number; y: number; width: number; height: number }): void;
  toSvg(label: string): string;
};

const BLACK = "rgb(0,0,0)";

function num(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function channel(value: number): number {
  return Math.round(value * 255);
}

function cssColor(color: Color | undefined): string {
  if (color?.type === ColorTypes.RGB) return `rgb(${channel(color.red)},${channel(color.green)},${channel(color.blue)})`;
  if (color?.type === ColorTypes.Grayscale) {
    const gray = channel(color.gray);
    return `rgb(${gray},${gray},${gray})`;
  }
  return BLACK;
}

export function createHtmlPage(width: number, height: number): HtmlPage {
  const shapes: string[] = [];
  // pdf-lib mide y hacia arriba; SVG, hacia abajo.
  const flip = (y: number) => num(height - y);

  return {
    drawText(value, options = {}) {
      const size = options.size ?? 12;
      // pdf-lib rechaza lo que su fuente no codifica; medirlo acá hace fallar igual a la vista
      // previa, en lugar de aprobar un comprobante cuyo PDF después no se puede generar.
      options.font?.widthOfTextAtSize(value, size);
      const bold = options.font?.name.includes("Bold") ? ' font-weight="700"' : "";
      const fill = options.color ? ` fill="${cssColor(options.color)}"` : "";
      shapes.push(`<text x="${num(options.x ?? 0)}" y="${flip(options.y ?? 0)}" font-size="${num(size)}"${bold}${fill}>${escapeHtml(value)}</text>`);
    },
    drawRectangle(options = {}) {
      const { x = 0, y = 0, width: boxWidth = 150, height: boxHeight = 100, color, borderColor, borderWidth = 0 } = options;
      // Mismas reglas que pdf-lib: sin color ni borde se rellena de negro; con borde pero sin
      // color el trazo toma `borderColor`; con ambos el trazo usa `borderColor` o negro.
      const unstyled = !("color" in options) && !("borderColor" in options);
      const fill = color ? cssColor(color) : unstyled ? BLACK : "none";
      const stroked = Boolean(borderWidth) && (Boolean(color) || Boolean(borderColor));
      const stroke = stroked ? ` stroke="${cssColor(borderColor)}" stroke-width="${num(borderWidth)}"` : "";
      shapes.push(`<rect x="${num(x)}" y="${flip(y + boxHeight)}" width="${num(boxWidth)}" height="${num(boxHeight)}" fill="${fill}"${stroke}/>`);
    },
    drawLine({ start, end, thickness = 1, color }) {
      shapes.push(`<line x1="${num(start.x)}" y1="${flip(start.y)}" x2="${num(end.x)}" y2="${flip(end.y)}" stroke="${cssColor(color)}" stroke-width="${num(thickness)}"/>`);
    },
    drawImage(href, box) {
      shapes.push(`<image href="${escapeHtml(href)}" x="${num(box.x)}" y="${flip(box.y + box.height)}" width="${num(box.width)}" height="${num(box.height)}"/>`);
    },
    toSvg(label) {
      return `<svg class="page" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}pt" height="${num(height)}pt" role="img" aria-label="${escapeHtml(label)}">${shapes.join("")}</svg>`;
    },
  };
}

/** Documento HTML autónomo con una hoja por página; imprime en A4 sin márgenes. */
export function buildHtmlDocument(title: string, pages: HtmlPage[]): string {
  const sheets = pages.map((page, index) => page.toSvg(`Hoja ${index + 1} de ${pages.length}`)).join("\n");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #e9eaec; }
.page { display: block; background: #fff; }
.page:not(:last-child) { margin-bottom: 12px; }
.page text { font-family: Helvetica, Arial, "Liberation Sans", sans-serif; font-kerning: none; white-space: pre; }
@media print {
  html, body { background: #fff; }
  .page:not(:last-child) { margin-bottom: 0; break-after: page; }
}
</style>
</head>
<body>
${sheets}
</body>
</html>`;
}
