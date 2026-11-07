/**
 * Redes sociales del taller: se configuran en Configuración > Taller y pueden imprimirse
 * en el encabezado de la factura. Las mismas reglas valen en el formulario y en la API.
 */

export const REDES_SOCIALES = ["whatsapp", "instagram", "facebook"] as const;
export type RedSocial = (typeof REDES_SOCIALES)[number];

/** Valores configurados; una red sin valor no aparece en el objeto. */
export type RedesSociales = Partial<Record<RedSocial, string>>;

export const RED_SOCIAL_MAX: Record<RedSocial, number> = {
  whatsapp: 30,
  instagram: 30,
  facebook: 80,
};

export const RED_SOCIAL_LABEL: Record<RedSocial, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

const WHATSAPP_PATTERN = /^\+?[\d\s()-]+$/;
const WHATSAPP_MIN_DIGITS = 6;
const WHATSAPP_MAX_DIGITS = 15;
const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export type RedSocialNormalizada = { value: string | null; error?: undefined } | { value?: undefined; error: string };

/**
 * Limpia y valida el valor ingresado para una red. Un valor vacío es `null` (la red no se
 * configura); Instagram se guarda sin la `@` inicial.
 */
export function normalizeRedSocial(red: RedSocial, raw: unknown): RedSocialNormalizada {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw !== "string") return { error: `${RED_SOCIAL_LABEL[red]} inválido` };
  let value = raw.trim().replace(/\s+/g, " ");
  if (red === "instagram") value = value.replace(/^@+/, "").trim();
  if (!value) return { value: null };

  if (red === "whatsapp") {
    const digits = value.replace(/\D/g, "").length;
    if (!WHATSAPP_PATTERN.test(value) || digits < WHATSAPP_MIN_DIGITS || digits > WHATSAPP_MAX_DIGITS
      || value.length > RED_SOCIAL_MAX.whatsapp) {
      return { error: "Ingresá un número de WhatsApp válido: sólo números, espacios, +, guiones o paréntesis." };
    }
  }
  if (red === "instagram" && !INSTAGRAM_PATTERN.test(value)) {
    return { error: "El usuario de Instagram sólo admite letras, números, puntos y guiones bajos (hasta 30)." };
  }
  if (red === "facebook" && value.length > RED_SOCIAL_MAX.facebook) {
    return { error: `El nombre de Facebook admite hasta ${RED_SOCIAL_MAX.facebook} caracteres.` };
  }
  return { value };
}

/** Redes con valor de una fila de `talleres` (o de un snapshot); ignora vacíos y tipos inválidos. */
export function redesSocialesDe(row: unknown): RedesSociales {
  const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const redes: RedesSociales = {};
  for (const red of REDES_SOCIALES) {
    const value = source[red];
    if (typeof value === "string" && value.trim()) redes[red] = value.trim();
  }
  return redes;
}

export function tieneRedesSociales(redes: RedesSociales | null | undefined): boolean {
  return Boolean(redes && REDES_SOCIALES.some((red) => redes[red]));
}

/** Texto con el que se muestra cada red (Instagram lleva la `@`). */
export function redSocialTexto(red: RedSocial, value: string): string {
  return red === "instagram" ? `@${value}` : value;
}
