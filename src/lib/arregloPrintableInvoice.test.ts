import { describe, expect, it } from "vitest";
import { formatArs } from "@/lib/format";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { buildArregloPrintableInvoiceHtml } from "./arregloPrintableInvoice";

function render(preciosIncluyenIva: boolean, precioFinal: number) {
  const data = {
    arreglo: {
      id: "arreglo-12345678",
      estado: "TERMINADO",
      fecha: "2026-10-10",
      precio_final: precioFinal,
      precios_incluyen_iva: preciosIncluyenIva,
      tasa_iva: preciosIncluyenIva ? null : 0.21,
      precio_sin_iva: preciosIncluyenIva ? null : 100,
      vehiculo: {},
      taller: null,
      observaciones: "",
    },
    detalles: [],
    asignaciones: [],
    detalle_formulario: { costo: 100, metadata: [] },
  } as unknown as ArregloDetalleData;
  return buildArregloPrintableInvoiceHtml({ data });
}

describe("buildArregloPrintableInvoiceHtml commercial total", () => {
  it("prints the persisted gross and the commercial IVA breakdown when prices exclude it", () => {
    const html = render(false, 121);

    expect(html).toContain("Subtotal");
    expect(html).toContain("<span>IVA</span>");
    expect(html).toContain(formatArs(100, { maxDecimals: 2, minDecimals: 0 }));
    expect(html).toContain(formatArs(21, { maxDecimals: 2, minDecimals: 0 }));
    expect(html).toContain(formatArs(121, { maxDecimals: 2, minDecimals: 0 }));
  });

  it("does not add an IVA row when prices already include IVA", () => {
    const html = render(true, 100);

    expect(html).toContain("Subtotal");
    expect(html).not.toContain("IVA");
    expect(html).toContain(formatArs(100, { maxDecimals: 2, minDecimals: 0 }));
  });
});

function renderFractionalServices() {
  const data = {
    arreglo: {
      id: "arreglo-rounding", estado: "TERMINADO", fecha: "2026-10-10",
      precio_final: 0.02, precio_sin_iva: 0.02, precios_incluyen_iva: false,
      tasa_iva: 0.21, vehiculo: {}, taller: null, observaciones: "",
    },
    detalles: [1, 2].map((id) => ({
      id: String(id), arreglo_id: "arreglo-rounding", descripcion: "Trabajo",
      cantidad: 1, horas_facturadas: 0.5, precio_hora_facturada: 0.01,
      horas_trabajadas: null, categoria_arreglo_id: null, empleado_id: null,
    })),
    asignaciones: [], detalle_formulario: null,
  } as unknown as ArregloDetalleData;
  return buildArregloPrintableInvoiceHtml({ data });
}

describe("buildArregloPrintableInvoiceHtml line rounding", () => {
  it("uses persisted net subtotal and does not invent IVA from floating-point sum drift", () => {
    const html = renderFractionalServices();
    const summary = html.slice(html.indexOf("bottom-totals"));

    expect(summary).toContain("Subtotal");
    expect(summary).toContain(formatArs(0.02, { maxDecimals: 2, minDecimals: 0 }));
    expect(summary).toContain("<span>IVA</span>");
    expect(summary).toContain(formatArs(0, { maxDecimals: 2, minDecimals: 0 }));
    expect(summary).toContain(formatArs(0.02, { maxDecimals: 2, minDecimals: 0 }));
  });
});

describe("buildArregloPrintableInvoiceHtml precios sin IVA", () => {
  it("muestra cada detalle con el neto cargado y el IVA solo en los totales", () => {
    const data = {
      arreglo: {
        id: "arreglo-neto", estado: "TERMINADO", fecha: "2026-10-10",
        precio_final: 121, precio_sin_iva: 100, precios_incluyen_iva: false,
        tasa_iva: 0.21, vehiculo: {}, taller: null, observaciones: "",
      },
      detalles: [{
        id: "d1", arreglo_id: "arreglo-neto", descripcion: "Mano de obra",
        cantidad: 1, horas_facturadas: 1, precio_hora_facturada: 100,
        horas_trabajadas: null, categoria_arreglo_id: null, empleado_id: null,
      }],
      asignaciones: [], detalle_formulario: null,
    } as unknown as ArregloDetalleData;

    const html = buildArregloPrintableInvoiceHtml({ data });
    const lines = html.slice(0, html.indexOf("bottom-totals\">"));
    const summary = html.slice(html.indexOf("bottom-totals\">"));

    expect(lines).toContain(formatArs(100, { maxDecimals: 2, minDecimals: 0 }));
    expect(lines).not.toContain(formatArs(121, { maxDecimals: 2, minDecimals: 0 }));
    expect(summary).toContain(formatArs(21, { maxDecimals: 2, minDecimals: 0 }));
    expect(summary).toContain(formatArs(121, { maxDecimals: 2, minDecimals: 0 }));
  });
});
