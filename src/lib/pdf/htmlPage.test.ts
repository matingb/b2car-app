import { PDFDocument, StandardFonts, grayscale, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildHtmlDocument, createHtmlPage, escapeHtml } from "./htmlPage";

describe("hoja HTML equivalente a una hoja de pdf-lib", () => {
  it("invierte el eje vertical y conserva las unidades en puntos", () => {
    const page = createHtmlPage(200, 100);
    page.drawLine({ start: { x: 10, y: 20 }, end: { x: 190, y: 20 }, thickness: 0.35, color: rgb(0.5, 0.5, 0.5) });
    page.drawRectangle({ x: 5, y: 10, width: 50, height: 30, color: rgb(1, 1, 1), borderWidth: 0.8 });
    const svg = page.toSvg("Hoja 1 de 1");
    expect(svg).toContain('viewBox="0 0 200 100" width="200pt" height="100pt"');
    expect(svg).toContain('<line x1="10" y1="80" x2="190" y2="80" stroke="rgb(128,128,128)" stroke-width="0.35"/>');
    // El rectángulo de pdf-lib se ancla abajo a la izquierda; SVG, arriba a la izquierda.
    expect(svg).toContain('<rect x="5" y="60" width="50" height="30" fill="rgb(255,255,255)" stroke="rgb(0,0,0)" stroke-width="0.8"/>');
  });

  it("aplica las reglas de relleno y borde de pdf-lib", () => {
    const page = createHtmlPage(100, 100);
    page.drawRectangle({ x: 0, y: 0, width: 10, height: 10 });
    page.drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: grayscale(0.2) });
    page.drawRectangle({ x: 0, y: 0, width: 10, height: 10, borderWidth: 1, borderColor: rgb(1, 0, 0) });
    const [unstyled, filled, outlined] = page.toSvg("Hoja").match(/<rect[^>]*>/g) ?? [];
    expect(unstyled).toContain('fill="rgb(0,0,0)"');
    expect(unstyled).not.toContain("stroke");
    expect(filled).toContain('fill="rgb(51,51,51)"');
    expect(filled).not.toContain("stroke");
    expect(outlined).toContain('fill="none" stroke="rgb(255,0,0)" stroke-width="1"');
  });

  it("dibuja texto en negrita y con color, escapando su contenido", async () => {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = createHtmlPage(100, 100);
    page.drawText("A & <B>", { x: 3, y: 4, font: regular, size: 8 });
    page.drawText("Total", { x: 3, y: 14, font: bold, size: 11, color: rgb(1, 1, 1) });
    const svg = page.toSvg("Hoja");
    expect(svg).toContain('<text x="3" y="96" font-size="8">A &amp; &lt;B&gt;</text>');
    expect(svg).toContain('<text x="3" y="86" font-size="11" font-weight="700" fill="rgb(255,255,255)">Total</text>');
  });

  it("rechaza lo que la fuente de pdf-lib no puede codificar", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(() => createHtmlPage(100, 100).drawText("🔧", { x: 0, y: 0, font, size: 8 })).toThrow();
  });

  it("arma un documento con una hoja por página y título escapado", () => {
    const first = createHtmlPage(100, 100);
    const second = createHtmlPage(100, 100);
    const html = buildHtmlDocument("Factura <A>", [first, second]);
    expect(html).toContain("<title>Factura &lt;A&gt;</title>");
    expect(html.match(/<svg class="page"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Hoja 2 de 2"');
    expect(html).toContain("@page { size: A4; margin: 0; }");
  });

  it("escapa los caracteres reservados", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});
