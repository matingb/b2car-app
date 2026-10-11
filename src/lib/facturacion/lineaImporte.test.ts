import { describe, expect, it } from "vitest";
import { fiscalizeLineas } from "./arcaPayload";
import { importeLineaMostrado, precioUnitarioMostrado } from "./lineaImporte";
import type { FacturaLinea } from "./types";

const linea = (preciosIncluyenIva: boolean): FacturaLinea => ({
  ordinal: 1,
  origen: "SERVICIO",
  descripcion: "Mano de obra",
  cantidad: 2,
  importeUnitario: 50,
  subtotal: 100,
  tratamientoIva: "GRAVADO",
  ivaAlicuotaId: 5,
  ivaAlicuota: 21,
  snapshot: { preciosIncluyenIva },
});

describe("importeLineaMostrado", () => {
  it("con precios sin IVA muestra el neto cargado y deja el IVA en los totales", () => {
    const fiscal = fiscalizeLineas([linea(false)], "RESPONSABLE_INSCRIPTO", false, 0.21);
    const [line] = fiscal.lineas;

    expect(importeLineaMostrado(line)).toBe(100);
    expect(precioUnitarioMostrado(line, importeLineaMostrado(line))).toEqual({ value: 50, maxDecimals: 2 });
    expect(fiscal.totales.netoGravado).toBe(100);
    expect(fiscal.totales.iva).toBe(21);
    expect(fiscal.totales.total).toBe(121);
  });

  it("para monotributista muestra el importe final porque no hay IVA discriminado", () => {
    const fiscal = fiscalizeLineas([linea(false)], "MONOTRIBUTISTA", false, 0.21);

    expect(importeLineaMostrado(fiscal.lineas[0])).toBe(121);
    expect(fiscal.totales.total).toBe(121);
  });

  it("con precios con IVA muestra el importe cargado", () => {
    const fiscal = fiscalizeLineas([linea(true)], "RESPONSABLE_INSCRIPTO", true, 0.21);

    expect(importeLineaMostrado(fiscal.lineas[0])).toBe(100);
    expect(fiscal.totales.total).toBe(100);
  });

  it("en el detalle simplificado sin IVA muestra el total menos el IVA", () => {
    expect(importeLineaMostrado({
      cantidad: 1, importeUnitario: 121, subtotal: 121, importeTotal: 121, importeIva: 21,
      snapshot: { detalleSimplificado: true, preciosIncluyenIva: false },
    })).toBe(100);
  });
});
