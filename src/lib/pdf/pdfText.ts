import type { PDFFont, PDFPage } from "pdf-lib";

/** Helpers de texto compartidos por los PDF generados con pdf-lib (comprobantes fiscales y remitos). */

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function formatDate(value: string | null | undefined): string {
  const iso = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }
  return iso || "-";
}

export function drawRight(page: PDFPage, value: string, right: number, y: number, font: PDFFont, size: number) {
  page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, font, size });
}

export function drawCentered(page: PDFPage, value: string, center: number, y: number, font: PDFFont, size: number) {
  page.drawText(value, { x: center - font.widthOfTextAtSize(value, size) / 2, y, font, size });
}

export function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
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

/**
 * Las fuentes estándar de pdf-lib solo codifican WinAnsi y fallan con otros caracteres
 * (por ejemplo emojis). Reemplaza los no soportados por `?` antes de dibujar texto libre.
 */
export function sanitizeForFont(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let output = "";
  for (const character of value.normalize("NFC")) {
    if (character === "\n" || character === "\r" || character === "\t") {
      output += character === "\t" ? " " : character;
      continue;
    }
    const codePoint = character.codePointAt(0) ?? 0;
    output += supported.has(codePoint) ? character : "?";
  }
  return output;
}
