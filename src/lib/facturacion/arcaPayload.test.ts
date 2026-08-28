import { describe, expect, it } from "vitest";
import {
  amountToCents,
  buildFacturaCPayload,
  deriveFacturaConcepto,
  FacturacionValidationError,
  validateDocument,
  validateFechas,
  validateLineasYTotal,
} from "./arcaPayload";
import type { FacturaLinea } from "./types";

const serviceLine: FacturaLinea = {
  ordinal: 1,
  origen: "SERVICIO",
  descripcion: "Cambio de aceite",
  cantidad: 2,
  importeUnitario: 1250.5,
  subtotal: 2501,
};

const partLine: FacturaLinea = {
  ordinal: 2,
  origen: "REPUESTO",
  descripcion: "Filtro",
  codigo: "FLT-01",
  cantidad: 1,
  importeUnitario: 499.99,
  subtotal: 499.99,
};

describe("facturación ARCA: detalle y totales", () => {
  it("deriva conceptos de servicios, repuestos y mixtos", () => {
    expect(deriveFacturaConcepto([serviceLine])).toBe(2);
    expect(deriveFacturaConcepto([partLine])).toBe(1);
    expect(deriveFacturaConcepto([serviceLine, partLine])).toBe(3);
  });

  it("calcula en centavos y exige coincidencia exacta con precio_final", () => {
    expect(amountToCents(2500.01)).toBe(250001);
    expect(validateLineasYTotal([serviceLine, partLine], 3000.99)).toBe(300099);
    expect(() => validateLineasYTotal([serviceLine, partLine], 3001)).toThrow(FacturacionValidationError);
  });

  it("rechaza más de dos decimales", () => {
    expect(() => amountToCents(10.001)).toThrow("dos decimales");
  });
});

describe("facturación ARCA: receptor y Factura C", () => {
  it("valida DNI, CUIL y CUIT sin permitir consumidor sin documento", () => {
    expect(validateDocument(96, "12.345.678")).toEqual({ tipoDocumento: 96, numeroDocumento: "12345678" });
    expect(validateDocument(86, "20-12345678-3")).toEqual({ tipoDocumento: 86, numeroDocumento: "20123456783" });
    expect(() => validateDocument(96, "123")).toThrow(FacturacionValidationError);
    expect(() => validateDocument(null, null)).toThrow(FacturacionValidationError);
  });

  it("construye Factura C sin IVA ni tributos y con fechas de servicio", () => {
    const payload = buildFacturaCPayload({
      voucherNumber: 42,
      puntoVenta: 7,
      concepto: 3,
      receptor: {
        clienteId: "cliente-1",
        nombre: "Ada Cliente",
        domicilio: "Calle 123",
        tipoDocumento: 96,
        numeroDocumento: "12345678",
        condicionIvaReceptorId: 5,
      },
      fechas: {
        fechaComprobante: "2026-08-28",
        fechaServicioDesde: "2026-08-01",
        fechaServicioHasta: "2026-08-28",
        fechaVencimientoPago: "2026-08-28",
      },
      totalCentavos: 300099,
    });
    expect(payload).toMatchObject({
      CbteTipo: 11,
      PtoVta: 7,
      CbteDesde: 42,
      CbteHasta: 42,
      ImpTotal: 3000.99,
      ImpNeto: 3000.99,
      ImpIVA: 0,
      ImpTrib: 0,
      CondicionIVAReceptorId: 5,
      FchServDesde: "20260801",
      FchServHasta: "20260828",
      FchVtoPago: "20260828",
    });
  });

  it("exige fechas ordenadas para servicios y no las requiere para productos", () => {
    expect(() => validateFechas(2, {
      fechaComprobante: "2026-08-28",
      fechaServicioDesde: "2026-08-28",
      fechaServicioHasta: "2026-08-01",
      fechaVencimientoPago: "2026-08-28",
    }, new Date("2026-08-28T12:00:00Z"))).toThrow("desde no puede ser posterior");

    expect(validateFechas(1, { fechaComprobante: "2026-08-28" }, new Date("2026-08-28T12:00:00Z")))
      .toMatchObject({ fechaComprobante: "2026-08-28" });
  });
});
