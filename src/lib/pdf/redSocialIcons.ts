import { LineCapStyle, type Color, type PDFPage } from "pdf-lib";
import type { RedSocial } from "@/lib/redesSociales";

/**
 * Íconos de redes sociales dibujados como trazos SVG (grilla de 24 × 24, estilo lucide).
 * Se dibujan con `drawSvgPath`, que existe tanto en `PDFPage` como en la hoja HTML, así
 * la vista previa y el PDF quedan iguales sin embeber imágenes.
 */

type IconPart = {
  d: string;
  /** Escala de la parte dentro de la grilla de 24 (1 = ocupa la grilla completa). */
  scale?: number;
  /** Grosor visible del trazo, relativo al tamaño del ícono. */
  stroke?: number;
};

// Burbuja de chat con un teléfono adentro, como el logo de WhatsApp.
const WHATSAPP: IconPart[] = [
  { d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" },
  {
    d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
    scale: 0.42,
    stroke: 0.07,
  },
];

const INSTAGRAM: IconPart[] = [
  { d: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01" },
];

const FACEBOOK: IconPart[] = [
  { d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
];

const ICONS: Record<RedSocial, IconPart[]> = { whatsapp: WHATSAPP, instagram: INSTAGRAM, facebook: FACEBOOK };

/** Grosor del trazo de lucide (2 sobre 24), relativo al tamaño del ícono. */
const DEFAULT_STROKE = 2 / 24;
const GRID = 24;

/** Cantidad de trazos que dibuja el ícono (cada parte es una llamada a `drawSvgPath`). */
export function redSocialIconParts(red: RedSocial): number {
  return ICONS[red].length;
}

/** Dibuja el ícono con su esquina inferior izquierda en `x`, `y`, como `drawImage`. */
export function drawRedSocialIcon(
  page: Pick<PDFPage, "drawSvgPath">,
  red: RedSocial,
  box: { x: number; y: number; size: number },
  color?: Color,
) {
  const unit = box.size / GRID;
  const top = box.y + box.size;
  for (const part of ICONS[red]) {
    const partScale = part.scale ?? 1;
    // La parte se centra en la grilla: una escala menor a 1 la corre hacia el centro.
    const offset = (GRID - GRID * partScale) / 2 * unit;
    const scale = unit * partScale;
    page.drawSvgPath(part.d, {
      x: box.x + offset,
      y: top - offset,
      scale,
      ...(color ? { borderColor: color } : {}),
      // drawSvgPath escala también el grosor: se divide para que el trazo visible no dependa de la parte.
      borderWidth: ((part.stroke ?? DEFAULT_STROKE) * box.size) / scale,
      borderLineCap: LineCapStyle.Round,
    });
  }
}
