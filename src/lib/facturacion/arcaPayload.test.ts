import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  amountToCents,
  buildFacturaCPayload,
  buildComprobantePayload,
  deriveFacturaConcepto,
  determineVoucher,
  FacturacionValidationError,
  fiscalizeLineas,
  toIsoDate,
  validateDocument,
  validateReceiverIdentification,
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
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("valida DNI, CUIL y CUIT sin permitir consumidor sin documento", () => {
    expect(validateDocument(96, "12.345.678")).toEqual({ tipoDocumento: 96, numeroDocumento: "12345678" });
    expect(validateDocument(86, "20-12345678-6")).toEqual({ tipoDocumento: 86, numeroDocumento: "20123456786" });
    expect(() => validateDocument(80, "20-12345678-7")).toThrow("no es válido");
    expect(() => validateDocument(96, "123")).toThrow(FacturacionValidationError);
    expect(() => validateDocument(null, null)).toThrow(FacturacionValidationError);
  });

  it("admite consumidor final sin identificar con documento 99", () => {
    expect(validateDocument(99, null)).toEqual({ tipoDocumento: 99, numeroDocumento: "0" });
  });

  it("exige CUIT para receptores con condición fiscal, incluso en Factura C", () => {
    expect(() => validateReceiverIdentification({
      tipoDocumento: 96,
      numeroDocumento: "12345678",
      condicionIvaReceptorId: 1,
    }, "C")).toThrow("Responsable Inscripto debe identificarse con CUIT");
    expect(validateReceiverIdentification({
      tipoDocumento: 80,
      numeroDocumento: "20-12345678-6",
      condicionIvaReceptorId: 1,
    }, "A")).toEqual({ tipoDocumento: 80, numeroDocumento: "20123456786" });
    expect(validateReceiverIdentification({
      tipoDocumento: 96,
      numeroDocumento: "12345678",
      condicionIvaReceptorId: 5,
    }, "B")).toEqual({ tipoDocumento: 96, numeroDocumento: "12345678" });
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

  it("toma la fecha de hoy en Argentina aunque en UTC ya sea el día siguiente", () => {
    // 22:30 del 11/10 en Argentina son las 01:30 del 12/10 en UTC.
    expect(toIsoDate(new Date("2026-10-12T01:30:00Z"))).toBe("2026-10-11");
    expect(toIsoDate(new Date("2026-10-11T03:00:00Z"))).toBe("2026-10-11");
    // 23:30 del 31/08 en Argentina: el comprobante del 31/08 sigue en el mes en curso.
    expect(validateFechas(1, { fechaComprobante: "2026-08-31" }, new Date("2026-09-01T02:30:00Z")))
      .toMatchObject({ fechaComprobante: "2026-08-31" });
  });
});

describe("facturación ARCA: matriz A/B/C e IVA", () => {
  it("determina clase y código según emisor, receptor y documento", () => {
    expect(determineVoucher("MONOTRIBUTISTA", 5, "FACTURA")).toEqual({ clase: "C", tipo: 11 });
    expect(determineVoucher("RESPONSABLE_INSCRIPTO", 1, "FACTURA")).toEqual({ clase: "A", tipo: 1 });
    expect(determineVoucher("RESPONSABLE_INSCRIPTO", 13, "FACTURA")).toEqual({ clase: "A", tipo: 1 });
    expect(determineVoucher("RESPONSABLE_INSCRIPTO", 16, "NOTA_CREDITO")).toEqual({ clase: "A", tipo: 3 });
    expect(determineVoucher("RESPONSABLE_INSCRIPTO", 5, "FACTURA")).toEqual({ clase: "B", tipo: 6 });
    expect(determineVoucher("RESPONSABLE_INSCRIPTO", 1, "NOTA_CREDITO")).toEqual({ clase: "A", tipo: 3 });
  });

  it("desagrega el IVA incluido y construye el bloque Iva para responsable inscripto", () => {
    const fiscal = fiscalizeLineas([{ ...partLine, subtotal: 121, importeUnitario: 121, ivaAlicuotaId: 5 }], "RESPONSABLE_INSCRIPTO");
    expect(fiscal.totales).toMatchObject({ netoGravado: 100, iva: 21, total: 121 });
    const payload = buildComprobantePayload({
      voucherNumber: 1,
      puntoVenta: 2,
      tipoComprobante: 6,
      claseComprobante: "B",
      concepto: 1,
      receptor: {
        clienteId: null,
        nombre: "Consumidor final",
        domicilio: null,
        tipoDocumento: 99,
        numeroDocumento: "0",
        condicionIvaReceptorId: 5,
      },
      fechas: { fechaComprobante: new Date().toISOString().slice(0, 10) },
      totales: fiscal.totales,
      lineas: fiscal.lineas,
    });
    expect(payload).toMatchObject({ CbteTipo: 6, ImpNeto: 100, ImpIVA: 21 });
    expect(payload.Iva).toEqual([{ Id: 5, BaseImp: 100, Importe: 21 }]);
  });

  it("exige CUIT cuando corresponde un comprobante A", () => {
    const fiscal = fiscalizeLineas([{ ...partLine, subtotal: 121, importeUnitario: 121 }], "RESPONSABLE_INSCRIPTO");
    expect(() => buildComprobantePayload({
      voucherNumber: 1,
      puntoVenta: 2,
      tipoComprobante: 1,
      claseComprobante: "A",
      concepto: 1,
      receptor: {
        clienteId: null,
        nombre: "Receptor monotributista",
        domicilio: null,
        tipoDocumento: 96,
        numeroDocumento: "12345678",
        condicionIvaReceptorId: 6,
      },
      fechas: { fechaComprobante: "2026-09-01" },
      totales: fiscal.totales,
      lineas: fiscal.lineas,
    })).toThrow("requieren CUIT");
  });

  it("emite payload FCE MiPyME con vencimiento y opcionales 2101/27", () => {
    const fiscal = fiscalizeLineas([{ ...partLine, subtotal: 121, importeUnitario: 121 }], "RESPONSABLE_INSCRIPTO");
    const today = new Date();
    const issuedOn = today.toISOString().slice(0, 10);
    const dueOn = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
    const previousDay = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
    const payload = buildComprobantePayload({
      voucherNumber: 5, puntoVenta: 2, tipoComprobante: 201, claseComprobante: "A", concepto: 1,
      receptor: { clienteId: null, nombre: "Emisor", domicilio: null, tipoDocumento: 80, numeroDocumento: "20123456786", condicionIvaReceptorId: 1 },
      fechas: { fechaComprobante: issuedOn, fechaVencimientoPago: dueOn },
      totales: fiscal.totales, lineas: fiscal.lineas, fceMipyme: true, fceCbu: "1234567890123456789012", fceSistema: "SCA",
    });
    expect(payload).toMatchObject({ CbteTipo: 201, FchVtoPago: dueOn.replaceAll("-", ""), Opcionales: [{ Id: 2101, Valor: "1234567890123456789012" }, { Id: 27, Valor: "SCA" }] });
    expect(() => validateFechas(1, { fechaComprobante: issuedOn, fechaVencimientoPago: previousDay }, today, true)).toThrow("no puede ser anterior");
  });

  it("aplica la ventana de cinco días para productos", () => {
    expect(() => validateFechas(1, { fechaComprobante: "2026-08-25" }, new Date("2026-09-01T12:00:00Z")))
      .toThrow("5 días");
  });
});


describe("fecha de vencimiento FCE", () => {
  it("exige la fecha posterior entre emisión y hoy para una factura retroactiva", () => {
    expect(() => validateFechas(1, { fechaComprobante: "2026-08-27", fechaVencimientoPago: "2026-08-27" }, new Date("2026-08-28T12:00:00Z"), true)).toThrow("fecha actual");
    expect(validateFechas(1, { fechaComprobante: "2026-08-27", fechaVencimientoPago: "2026-08-28" }, new Date("2026-08-28T12:00:00Z"), true).fechaVencimientoPago).toBe("2026-08-28");
  });
});

describe("B2C-197: precios persistidos sin IVA", () => {
  const line = (amount: number, ivaAlicuotaId = 5): FacturaLinea => ({
    ...serviceLine, cantidad: 1, importeUnitario: amount, subtotal: amount, ivaAlicuotaId,
  });

  it("conserva default incluido y suma IVA una sola vez desde netos", () => {
    expect(fiscalizeLineas([line(121)], "RESPONSABLE_INSCRIPTO").totales).toMatchObject({ netoGravado: 100, iva: 21, total: 121 });
    const fiscal = fiscalizeLineas([line(100)], "RESPONSABLE_INSCRIPTO", false, 0.21);
    expect(fiscal.totales).toMatchObject({ netoGravado: 100, iva: 21, total: 121 });
    expect(fiscal.lineas[0]).toMatchObject({ importeUnitario: 100, subtotal: 100, importeTotal: 121 });
  });

  it("preserva tasas legales mixtas, exentos, no gravados y cero", () => {
    const fiscal = fiscalizeLineas([
      line(100), line(100, 4), { ...line(50), tratamientoIva: "EXENTO" },
      { ...line(10), tratamientoIva: "NO_GRAVADO" }, line(10, 3),
    ], "RESPONSABLE_INSCRIPTO", true);
    expect(fiscal.totales).toMatchObject({ netoGravado: 183.14, iva: 26.86, exento: 50, noGravado: 10, total: 270 });
  });

  it("redondea el IVA sobre subtotal, no por unidad", () => {
    const fiscal = fiscalizeLineas([{ ...line(0.01), cantidad: 3, subtotal: 0.03 }], "RESPONSABLE_INSCRIPTO", false, 0.21);
    expect(fiscal.totales).toMatchObject({ netoGravado: 0.03, iva: 0.01, total: 0.04 });
    expect(fiscal.lineas[0]).toMatchObject({ importeUnitario: 0.01, subtotal: 0.03, importeTotal: 0.04 });
  });

  it("revierte alícuota legal sobre gross comercial cuando no coincide", () => {
    expect(fiscalizeLineas([line(100, 4)], "RESPONSABLE_INSCRIPTO", false, 0.21).totales).toMatchObject({ netoGravado: 109.5, iva: 11.5, total: 121 });
    expect(fiscalizeLineas([line(100)], "RESPONSABLE_INSCRIPTO", false, 0.10).totales).toMatchObject({ netoGravado: 90.91, iva: 19.09, total: 110 });
  });

  it("factura C conserva el gross comercial sin volver a sumar IVA; incluido no duplica", () => {
    expect(fiscalizeLineas([line(100)], "MONOTRIBUTISTA", false, 0.21).totales).toMatchObject({ netoGravado: 121, iva: 0, total: 121 });
    expect(fiscalizeLineas([line(121)], "RESPONSABLE_INSCRIPTO", true, 0.21).totales).toMatchObject({ netoGravado: 100, iva: 21, total: 121 });
  });

  it("preserva toda la precisión de la tasa comercial decimal", () => {
    expect(fiscalizeLineas([line(1000)], "MONOTRIBUTISTA", false, 0.12345).totales)
      .toMatchObject({ netoGravado: 1123.45, iva: 0, total: 1123.45 });
  });
});
