import { describe, expect, it } from "vitest";
import {
  CONCEPTO_NUEVO,
  buildConceptosCatalogo,
  conceptosError,
  newConcepto,
  removeConcepto,
  selectOrigen,
  setCantidad,
  setDescripcion,
  setImporte,
  sumCents,
  toConceptosPayload,
  type ConceptoNotaCatalogo,
} from "./notaCreditoConceptos";

const bateria: ConceptoNotaCatalogo = { ordinal: 1, descripcion: "Batería", codigo: "BAT", cantidadOriginal: 5, unitarioCents: 100_000, topeCents: 500_000, stockRestante: 3 };
const servicio: ConceptoNotaCatalogo = { ordinal: 2, descripcion: "Mano de obra", codigo: null, cantidadOriginal: 1, unitarioCents: 300_000, topeCents: 300_000, stockRestante: null };
const aceite: ConceptoNotaCatalogo = { ordinal: 3, descripcion: "Aceite", codigo: null, cantidadOriginal: 3, unitarioCents: 50_000, topeCents: 150_000, stockRestante: 0 };
const catalog = [bateria, servicio, aceite];

describe("conceptos de la nota de crédito", () => {
  it("arma el catálogo vinculando el stock retornable por línea de origen", () => {
    expect(buildConceptosCatalogo([
      { ordinal: 1, sourceId: "linea-1", descripcion: "Batería", codigo: "BAT", cantidad: 5, subtotal: 5000 },
      { ordinal: 2, sourceId: null, descripcion: "Mano de obra", cantidad: 1, subtotal: 3000 },
    ], [{ operacionLineaId: "linea-1", restante: 3 }])).toEqual([bateria, servicio]);
  });

  it("usa lo facturado con IVA y expande las líneas reales de una factura simplificada", () => {
    const netas = [
      { ordinal: 1, sourceId: "linea-1", descripcion: "Batería", codigo: "BAT", cantidad: 5, subtotal: 5000, importeTotal: 6050 },
      { ordinal: 2, sourceId: null, descripcion: "Mano de obra", cantidad: 1, subtotal: 3000, importeTotal: 3630 },
    ];
    const simplificada = { ordinal: 1, sourceId: null, descripcion: "Servicio de reparación", cantidad: 1, subtotal: 9680, importeTotal: 9680, snapshot: { lineasOriginales: netas } };
    const catalogo = buildConceptosCatalogo([simplificada], [{ operacionLineaId: "linea-1", restante: 5 }]);
    expect(catalogo).toEqual([
      { ...bateria, unitarioCents: 121_000, topeCents: 605_000, stockRestante: 5 },
      { ...servicio, unitarioCents: 363_000, topeCents: 363_000 },
    ]);
  });

  it("una línea nueva queda pendiente hasta elegir qué acredita", () => {
    const items = [newConcepto("a")];
    expect(items[0]).toEqual(expect.objectContaining({ tipo: "PENDIENTE", ordinal: null, importeCents: 0 }));
    expect(conceptosError(items)).toMatch(/Elegí un producto de la factura o un concepto nuevo/);
    expect(conceptosError([])).toMatch(/Agregá al menos un concepto/);
  });

  it("al elegir una línea de la factura sugiere devolver todo el disponible a precio original", () => {
    const [product] = selectOrigen([newConcepto("a")], "a", "1", catalog);
    expect(product).toEqual(expect.objectContaining({ tipo: "FACTURA", ordinal: 1, cantidad: 3, importeCents: 300_000 }));
    const [service] = selectOrigen([newConcepto("b")], "b", "2", catalog);
    expect(service).toEqual(expect.objectContaining({ tipo: "FACTURA", ordinal: 2, cantidad: 0, importeCents: 300_000 }));
    const [noStockLeft] = selectOrigen([newConcepto("c")], "c", "3", catalog);
    expect(noStockLeft).toEqual(expect.objectContaining({ cantidad: 0, importeCents: 150_000 }));
  });

  it("no permite usar dos veces la misma línea de la factura", () => {
    let items = selectOrigen([newConcepto("a"), newConcepto("b")], "a", "1", catalog);
    items = selectOrigen(items, "b", "1", catalog);
    expect(items[1]).toEqual(expect.objectContaining({ tipo: "PENDIENTE", ordinal: null }));
  });

  it("un concepto nuevo pide descripción y no tiene tope por línea", () => {
    let items = selectOrigen([newConcepto("a")], "a", CONCEPTO_NUEVO, catalog);
    expect(items[0]).toEqual(expect.objectContaining({ tipo: "PROPIO", ordinal: null }));
    items = setImporte(items, "a", 9_999_999, catalog);
    expect(conceptosError(items)).toMatch(/Completá la descripción/);
    items = setDescripcion(items, "a", "  Bonificación comercial ");
    expect(conceptosError(items)).toBeNull();
    expect(toConceptosPayload(items)).toEqual([{ descripcion: "Bonificación comercial", importe: 99_999.99 }]);
  });

  it("cambiar la cantidad recalcula el monto con el precio original y respeta el disponible", () => {
    const items = selectOrigen([newConcepto("a")], "a", "1", catalog);
    expect(setCantidad(items, "a", 2, catalog)[0]).toEqual(expect.objectContaining({ cantidad: 2, importeCents: 200_000 }));
    expect(setCantidad(items, "a", 9, catalog)[0]).toEqual(expect.objectContaining({ cantidad: 3, importeCents: 300_000 }));
    expect(setCantidad(items, "a", 0, catalog)[0]).toEqual(expect.objectContaining({ cantidad: 0, importeCents: 0 }));
  });

  it("limita el monto de una línea de la factura a lo facturado y suma el importe de la nota", () => {
    let items = selectOrigen(selectOrigen([newConcepto("a"), newConcepto("b")], "a", "1", catalog), "b", "2", catalog);
    items = setImporte(items, "b", 999_999, catalog);
    expect(items[1].importeCents).toBe(300_000);
    expect(sumCents(items)).toBe(600_000);
    expect(toConceptosPayload(items)).toEqual([{ ordinal: 1, importe: 3000 }, { ordinal: 2, importe: 3000 }]);
    expect(sumCents(removeConcepto(items, "a"))).toBe(300_000);
  });
});
