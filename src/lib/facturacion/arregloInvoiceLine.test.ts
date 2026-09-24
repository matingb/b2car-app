import { describe, expect, it } from "vitest";
import type { FacturaLinea } from "./types";
import { createArregloServiceInvoiceLine } from "./arregloInvoiceLine";

describe("createArregloServiceInvoiceLine", () => {
  it("omite la mano de obra con cero horas y conserva un repuesto facturable", () => {
    const repuesto: FacturaLinea = {
      ordinal: 1,
      origen: "REPUESTO",
      sourceId: "stock-1",
      descripcion: "Filtro",
      cantidad: 1,
      importeUnitario: 5000,
      subtotal: 5000,
      ivaAlicuotaId: 5,
    };
    const lineas = [repuesto];

    const servicio = createArregloServiceInvoiceLine({
      sourceId: "detalle-1",
      descripcion: "Mano de obra no facturada",
      cantidad: 1,
      horasFacturadas: 0,
      importeUnitario: 15000,
      ivaAlicuotaId: 5,
      snapshot: {},
    });
    if (servicio) lineas.push({ ...servicio, ordinal: lineas.length + 1 });

    expect(lineas).toEqual([repuesto]);
  });

  it("usa la cantidad sólo cuando las horas históricas son desconocidas", () => {
    const line = createArregloServiceInvoiceLine({
      sourceId: "detalle-1",
      descripcion: "Mano de obra histórica",
      cantidad: 2,
      horasFacturadas: null,
      importeUnitario: 1500,
      ivaAlicuotaId: 5,
      snapshot: {},
    });

    expect(line).toMatchObject({ cantidad: 2, subtotal: 3000 });
  });
});
