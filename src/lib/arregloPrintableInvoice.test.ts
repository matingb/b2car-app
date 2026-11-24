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

describe("buildArregloPrintableInvoiceHtml showPrices y showObservations options", () => {
  const baseData = {
    arreglo: {
      id: "arreglo-options",
      estado: "TERMINADO",
      fecha: "2026-10-10",
      precio_final: 200,
      precio_sin_iva: 200,
      precios_incluyen_iva: true,
      tasa_iva: null,
      vehiculo: { marca: "Ford", modelo: "Fiesta", patente: "AB123CD" },
      taller: null,
      observaciones: "Cambio urgente de pastillas de freno",
    },
    detalles: [
      {
        id: "d1",
        arreglo_id: "arreglo-options",
        descripcion: "Mano de obra frenos",
        cantidad: 1,
        horas_facturadas: 2,
        precio_hora_facturada: 50,
        horas_trabajadas: null,
        categoria_arreglo_id: null,
        empleado_id: null,
      },
    ],
    asignaciones: [],
    detalle_formulario: null,
  } as unknown as ArregloDetalleData;

  it("oculta precios y totales cuando showPrices es false", () => {
    const html = buildArregloPrintableInvoiceHtml({
      data: baseData,
      showPrices: false,
    });

    expect(html).toContain("Mano de obra frenos");
    expect(html).not.toContain('<div class="bottom-totals">');
    expect(html).not.toContain("$ Unidad");
    expect(html).not.toContain("$Subtotal");
    expect(html).not.toContain(formatArs(200, { maxDecimals: 2, minDecimals: 0 }));
  });

  it("oculta la seccion de observaciones cuando showObservations es false", () => {
    const htmlWithObs = buildArregloPrintableInvoiceHtml({
      data: baseData,
      showObservations: true,
    });
    expect(htmlWithObs).toContain('class="observations-label"');
    expect(htmlWithObs).toContain("Cambio urgente de pastillas de freno");

    const htmlWithoutObs = buildArregloPrintableInvoiceHtml({
      data: baseData,
      showObservations: false,
    });
    expect(htmlWithoutObs).not.toContain('class="observations-label"');
    expect(htmlWithoutObs).not.toContain("Cambio urgente de pastillas de freno");
  });

  it("prioriza numero_orden para el número de orden en el encabezado HTML", () => {
    const dataConNumero = {
      ...baseData,
      arreglo: {
        ...baseData.arreglo,
        numero_orden: 99,
      },
    } as unknown as ArregloDetalleData;

    const html = buildArregloPrintableInvoiceHtml({ data: dataConNumero });
    expect(html).toContain("00000099");
  });

  it("renderiza columnas de subtotal, descuento y total cuando showDiscounts es true", () => {
    const dataConDescuento = {
      ...baseData,
      arreglo: {
        ...baseData.arreglo,
        precio_final: 170,
        precio_sin_iva: 170,
      },
      detalles: [
        {
          id: "d1",
          arreglo_id: "arreglo-options",
          descripcion: "Mano de obra frenos",
          cantidad: 1,
          horas_facturadas: 2,
          precio_hora_facturada: 50,
          descuento: 20,
          horas_trabajadas: null,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
      ],
      asignaciones: [
        {
          id: "op1",
          tipo: "egreso",
          taller_id: "t1",
          created_at: "2026-01-01",
          lineas: [
            {
              id: "l1",
              operacion_id: "op1",
              stock_id: "s1",
              cantidad: 1,
              monto_unitario: 100,
              descuento: 10,
              delta_cantidad: -1,
              created_at: "2026-01-01",
              categoria_arreglo_id: null,
              empleado_id: null,
              producto: { id: "p1", codigo: "PAS-01", nombre: "Pastillas" },
            },
          ],
        },
      ],
    } as unknown as ArregloDetalleData;

    const htmlConDescuentos = buildArregloPrintableInvoiceHtml({
      data: dataConDescuento,
      showPrices: true,
      showDiscounts: true,
    });

    // Encabezados de tabla de servicios
    expect(htmlConDescuentos).toContain('<th class="discount">Descuento</th>');
    expect(htmlConDescuentos).toContain('<th class="total">Total</th>');
    // Línea de servicios: subtotal $100, descuento $20, total $80
    expect(htmlConDescuentos).toContain(formatArs(100, { maxDecimals: 2, minDecimals: 0 }));
    expect(htmlConDescuentos).toContain(formatArs(20, { maxDecimals: 2, minDecimals: 0 }));
    expect(htmlConDescuentos).toContain(formatArs(80, { maxDecimals: 2, minDecimals: 0 }));

    // Línea de repuestos: unit $100, subtotal $100, desc $10, total $90
    expect(htmlConDescuentos).toContain(formatArs(10, { maxDecimals: 2, minDecimals: 0 }));
    expect(htmlConDescuentos).toContain(formatArs(90, { maxDecimals: 2, minDecimals: 0 }));

    // Totales inferiores
    expect(htmlConDescuentos).toContain("Subtotal bruto");
    expect(htmlConDescuentos).toContain("Descuento");
    expect(htmlConDescuentos).toContain(formatArs(200, { maxDecimals: 2, minDecimals: 0 })); // Bruto $100+$100
    expect(htmlConDescuentos).toContain(`-${formatArs(30, { maxDecimals: 2, minDecimals: 0 })}`); // Descuento $20+$10
    expect(htmlConDescuentos).toContain(formatArs(170, { maxDecimals: 2, minDecimals: 0 })); // Total final $170
  });

  it("no muestra columnas ni totales de descuento cuando showDiscounts es false", () => {
    const dataConDescuento = {
      ...baseData,
      detalles: [
        {
          id: "d1",
          arreglo_id: "arreglo-options",
          descripcion: "Mano de obra frenos",
          cantidad: 1,
          horas_facturadas: 2,
          precio_hora_facturada: 50,
          descuento: 20,
          horas_trabajadas: null,
          categoria_arreglo_id: null,
          empleado_id: null,
        },
      ],
    } as unknown as ArregloDetalleData;

    const htmlSinDescuentos = buildArregloPrintableInvoiceHtml({
      data: dataConDescuento,
      showPrices: true,
      showDiscounts: false,
    });

    expect(htmlSinDescuentos).not.toContain('<th class="discount">Descuento</th>');
    expect(htmlSinDescuentos).not.toContain("Subtotal bruto");
  });
});

describe("formatInvoiceNumber", () => {
  it("prioriza numero_orden con padding de 8 ceros", async () => {
    const { formatInvoiceNumber } = await import("./arregloPrintableInvoice");
    expect(formatInvoiceNumber({ id: "uuid-12345", numero_orden: 42 })).toBe("00000042");
    expect(formatInvoiceNumber({ id: "uuid-12345", numero_orden: 1 })).toBe("00000001");
  });

  it("utiliza shortInvoiceNumber como fallback si numero_orden es nulo", async () => {
    const { formatInvoiceNumber } = await import("./arregloPrintableInvoice");
    expect(formatInvoiceNumber({ id: "a1-12345678", numero_orden: null })).toBe("12345678");
  });
});

