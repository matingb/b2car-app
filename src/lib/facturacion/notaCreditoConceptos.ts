/**
 * Conceptos de una nota de crédito. Cada concepto es una línea de la factura
 * original (con tope en lo facturado y, si corresponde, stock a devolver) o un
 * concepto propio de la nota, sin relación con el stock. El total de la nota es
 * la suma de los conceptos. Los montos se manejan en centavos enteros.
 */

export const CONCEPTO_NUEVO = "__nuevo__";

export type ConceptoNotaCatalogo = {
  ordinal: number;
  descripcion: string;
  codigo: string | null;
  cantidadOriginal: number;
  unitarioCents: number;
  /** Importe facturado en la línea original: tope del concepto en la nota. */
  topeCents: number;
  /** Unidades que todavía pueden volver al stock; null si la línea no mueve stock. */
  stockRestante: number | null;
};

export type ConceptoNota = {
  key: string;
  /** PENDIENTE: línea recién agregada, todavía sin elegir qué acredita. */
  tipo: "PENDIENTE" | "FACTURA" | "PROPIO";
  ordinal: number | null;
  descripcion: string;
  cantidad: number;
  importeCents: number;
};

export type ConceptoNotaPayload =
  | { ordinal: number; importe: number }
  | { descripcion: string; importe: number };

export function toCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumCents(items: ConceptoNota[]): number {
  return items.reduce((sum, item) => sum + item.importeCents, 0);
}

type LineaOriginal = {
  ordinal: number;
  sourceId?: string | null;
  descripcion: string;
  codigo?: string | null;
  cantidad: number;
  subtotal: number;
  /** Importe con IVA; en facturas con precios sin IVA el subtotal es neto. */
  importeTotal?: number;
  snapshot?: Record<string, unknown>;
};

/**
 * Una factura con detalle simplificado guarda una sola línea fiscal, pero conserva
 * las líneas reales (con su alícuota y su procedencia de stock) en el snapshot.
 * Cliente y servidor expanden igual, así los ordinales de los conceptos coinciden.
 */
export function expandirLineasOriginales<T extends LineaOriginal>(lineas: T[]): T[] {
  return lineas.flatMap((line) => Array.isArray(line.snapshot?.lineasOriginales)
    ? line.snapshot.lineasOriginales as T[]
    : [line]);
}

/** Lo facturado con IVA en una línea: es el tope de lo que una NC puede acreditar sobre ella. */
export function importeFacturadoCents(line: LineaOriginal): number {
  return toCents(line.importeTotal ?? line.subtotal);
}

/**
 * Catálogo de conceptos acreditables: cada línea de la factura original, con su
 * stock retornable cuando la línea proviene de una salida física verificada.
 */
export function buildConceptosCatalogo(
  lineas: LineaOriginal[],
  stock: { operacionLineaId: string; restante: number }[],
): ConceptoNotaCatalogo[] {
  const stockByLine = new Map(stock.map((item) => [item.operacionLineaId, item]));
  return expandirLineasOriginales(lineas)
    .filter((line) => importeFacturadoCents(line) > 0)
    .map((line) => {
      const stockItem = line.sourceId ? stockByLine.get(line.sourceId) : undefined;
      const topeCents = importeFacturadoCents(line);
      return {
        ordinal: line.ordinal,
        descripcion: line.descripcion,
        codigo: line.codigo ?? null,
        cantidadOriginal: line.cantidad,
        unitarioCents: line.cantidad > 0 ? Math.round(topeCents / line.cantidad) : topeCents,
        topeCents,
        stockRestante: stockItem ? stockItem.restante : null,
      };
    });
}

/** Monto sugerido para una línea de la factura: precio original por unidades devueltas, o la línea completa. */
export function suggestedCents(line: ConceptoNotaCatalogo, cantidad: number): number {
  if (line.stockRestante === null || cantidad <= 0 || cantidad >= line.cantidadOriginal) return line.topeCents;
  return Math.min(line.topeCents, Math.round(line.unitarioCents * cantidad));
}

export function newConcepto(key: string): ConceptoNota {
  return { key, tipo: "PENDIENTE", ordinal: null, descripcion: "", cantidad: 0, importeCents: 0 };
}

function update(items: ConceptoNota[], key: string, change: (item: ConceptoNota) => ConceptoNota): ConceptoNota[] {
  return items.map((item) => item.key === key ? change(item) : item);
}

/** Elige qué acredita la línea: una línea de la factura (por ordinal) o un concepto nuevo. */
export function selectOrigen(items: ConceptoNota[], key: string, value: string, catalog: ConceptoNotaCatalogo[]): ConceptoNota[] {
  if (value === CONCEPTO_NUEVO) {
    return update(items, key, (item) => ({ ...newConcepto(item.key), tipo: "PROPIO" }));
  }
  const line = catalog.find((candidate) => String(candidate.ordinal) === value);
  if (!line || items.some((item) => item.key !== key && item.ordinal === line.ordinal)) {
    return update(items, key, (item) => newConcepto(item.key));
  }
  const cantidad = line.stockRestante ?? 0;
  return update(items, key, (item) => ({
    ...newConcepto(item.key), tipo: "FACTURA", ordinal: line.ordinal, cantidad, importeCents: suggestedCents(line, cantidad),
  }));
}

export function setDescripcion(items: ConceptoNota[], key: string, descripcion: string): ConceptoNota[] {
  return update(items, key, (item) => item.tipo === "PROPIO" ? { ...item, descripcion } : item);
}

/** Cambiar la cantidad devuelta recalcula el monto con el precio original; con 0 el monto queda en 0. */
export function setCantidad(items: ConceptoNota[], key: string, cantidad: number, catalog: ConceptoNotaCatalogo[]): ConceptoNota[] {
  return update(items, key, (item) => {
    const line = catalog.find((candidate) => candidate.ordinal === item.ordinal);
    if (!line || line.stockRestante === null) return item;
    const safe = Math.max(0, Math.min(line.stockRestante, Math.trunc(cantidad) || 0));
    return { ...item, cantidad: safe, importeCents: safe > 0 ? suggestedCents(line, safe) : 0 };
  });
}

/** Un concepto de la factura no puede superar lo facturado en su línea; uno propio no tiene tope por línea. */
export function setImporte(items: ConceptoNota[], key: string, importeCents: number, catalog: ConceptoNotaCatalogo[]): ConceptoNota[] {
  return update(items, key, (item) => {
    const tope = catalog.find((candidate) => candidate.ordinal === item.ordinal)?.topeCents ?? Number.POSITIVE_INFINITY;
    return { ...item, importeCents: Math.max(0, Math.min(tope, Math.round(importeCents) || 0)) };
  });
}

export function removeConcepto(items: ConceptoNota[], key: string): ConceptoNota[] {
  return items.filter((item) => item.key !== key);
}

export function conceptosError(items: ConceptoNota[]): string | null {
  if (!items.length) return "Agregá al menos un concepto a la nota.";
  if (items.some((item) => item.tipo === "PENDIENTE")) return "Elegí un producto de la factura o un concepto nuevo en cada línea.";
  if (items.some((item) => item.tipo === "PROPIO" && !item.descripcion.trim())) return "Completá la descripción de los conceptos nuevos.";
  if (items.some((item) => item.importeCents <= 0)) return "Cada concepto debe tener un monto mayor a 0.";
  return null;
}

export function toConceptosPayload(items: ConceptoNota[]): ConceptoNotaPayload[] {
  return items.map((item) => item.tipo === "FACTURA" && item.ordinal !== null
    ? { ordinal: item.ordinal, importe: fromCents(item.importeCents) }
    : { descripcion: item.descripcion.trim(), importe: fromCents(item.importeCents) });
}
