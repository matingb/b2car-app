type CodeEnv = {
  items: ReadonlyArray<{
    tipo?: string;
    nuevoProducto?: { codigo?: string | null } | null;
    produto?: { codigo?: string | null } | null;
  }>;
  inventario: ReadonlyArray<{ codigo?: string | null }>;
};

const NEW_PRODUCT_CODE_PREFIX = "AL";

const STOP_WORDS = new Set(["de", "el", "la", "los", "las", "del", "un", "una", "y", "a", "en", "por", "con", "para"]);

function toSlugBase(nombre: string): string {
  const normalized = nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();

  const parts = normalized
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.slice(0, 3));

  return parts.join("-");
}

export function getNextNewProductCode(env: CodeEnv): string {
  const codes = [
    ...env.inventario.map((s) => s.codigo),
    ...env.items.map((i) =>
      i.tipo === "nuevo" ? i.nuevoProducto?.codigo : i.produto?.codigo,
    ),
  ];

  const max = codes.reduce((currentMax, rawCode) => {
    const code = String(rawCode ?? "").trim().toUpperCase();
    if (!code.startsWith(NEW_PRODUCT_CODE_PREFIX)) return currentMax;

    const suffix = code.slice(NEW_PRODUCT_CODE_PREFIX.length);
    if (!/^\d+$/.test(suffix)) return currentMax;

    return Math.max(currentMax, Number(suffix));
  }, 0);

  return `${NEW_PRODUCT_CODE_PREFIX}${max + 1}`;
}

export function generateProductCode(nombre: string, env: CodeEnv): string {
  const base = toSlugBase(nombre.trim());
  if (!base) return getNextNewProductCode(env);

  const existingCodes = new Set([
    ...env.inventario.map((s) => String(s.codigo ?? "").trim().toUpperCase()),
    ...env.items.map((i) => {
      const c = i.tipo === "nuevo" ? i.nuevoProducto?.codigo : i.produto?.codigo;
      return String(c ?? "").trim().toUpperCase();
    }),
  ]);

  for (let counter = 1; counter <= 999; counter++) {
    const candidate = `${base}-${String(counter).padStart(3, "0")}`;
    if (!existingCodes.has(candidate)) return candidate;
  }

  return getNextNewProductCode(env);
}
