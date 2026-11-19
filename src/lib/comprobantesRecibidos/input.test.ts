import { describe, expect, it } from "vitest";
import { parseComprobanteRecibidoInput } from "./input";

const factura = {
  tipoDocumento: "FACTURA", clase: "A", numero: "1-123", fecha: "2026-01-01",
  emisor: { razonSocial: "Proveedor", cuit: "30712345678", condicionIva: "RESPONSABLE_INSCRIPTO" },
  lineas: [{ tipo: "CONCEPTO", descripcion: "Producto", importe: 34200, ivaAlicuotaId: 5 }],
  desgloseIva: [{ ivaAlicuotaId: 5, base: 10000, iva: 2100 }, { ivaAlicuotaId: 4, base: 20000, iva: 2100 }],
};

describe("desglose fiscal de comprobantes recibidos", () => {
  it("conserva las alícuotas y los importes confirmados", () => {
    const result = parseComprobanteRecibidoInput(factura);
    expect(result.error).toBeUndefined();
    expect(result.value?.desgloseIva).toEqual(factura.desgloseIva);
    expect(result.value?.lineas[0].ivaAlicuotaId).toBe(5);
  });

  it("mantiene desconocido un documento histórico sin desglose", () => {
    const result = parseComprobanteRecibidoInput({ ...factura, desgloseIva: undefined, lineas: [{ tipo: "CONCEPTO", descripcion: "Anterior", importe: 12100 }] });
    expect(result.value?.desgloseIva).toBeNull();
    expect(result.value?.lineas[0].ivaAlicuotaId).toBeNull();
  });

  it("rechaza tasas repetidas y limita el desglose discriminado a facturas A", () => {
    expect(parseComprobanteRecibidoInput({ ...factura, desgloseIva: [factura.desgloseIva[0], factura.desgloseIva[0]] }).error).toBeTruthy();
    const facturaB = parseComprobanteRecibidoInput({
      ...factura,
      clase: "B",
      desgloseIva: null,
      lineas: [{ ...factura.lineas[0], importe: 12100, ivaAlicuotaId: null }],
    });
    expect(facturaB.error).toBeUndefined();
    expect(facturaB.value?.lineas[0].ivaAlicuotaId).toBeNull();
    expect(parseComprobanteRecibidoInput({
      ...factura,
      clase: "B",
      lineas: [{ ...factura.lineas[0], ivaAlicuotaId: null }],
      desgloseIva: factura.desgloseIva,
    }).error).toContain("solo corresponde a facturas A");
  });

  it("guarda IVA contenido de factura B separado y sin inferirlo", () => {
    const result = parseComprobanteRecibidoInput({
      ...factura,
      clase: "B",
      desgloseIva: null,
      ivaContenido: 21,
      lineas: [{ ...factura.lineas[0], importe: 121, ivaAlicuotaId: null }],
    });
    expect(result.error).toBeUndefined();
    expect(result.value?.ivaContenido).toBe(21);
    expect(result.value?.desgloseIva).toBeNull();
    expect(parseComprobanteRecibidoInput({ ...factura, ivaContenido: 21 }).error).toContain("solo corresponde a facturas B");
    expect(parseComprobanteRecibidoInput({
      ...factura,
      clase: "B",
      desgloseIva: null,
      ivaContenido: 122,
      lineas: [{ ...factura.lineas[0], importe: 121, ivaAlicuotaId: null }],
    }).error).toContain("no puede superar el total de conceptos");
  });

  it("rechaza un desglose mayor a los conceptos aunque haya percepciones", () => {
    const lineas = [{ tipo: "CONCEPTO", descripcion: "Producto", importe: 12100, ivaAlicuotaId: 5 }, { tipo: "PERCEPCION", descripcion: "IVA", percepcionCodigo: "IVA", importe: 22100 }];
    expect(parseComprobanteRecibidoInput({ ...factura, lineas }).error).toContain("total de conceptos");
  });

  it("acepta un desglose parcial y conserva ceros explícitos", () => {
    const desgloseIva = [{ ivaAlicuotaId: 3, base: 100, iva: 0 }, { ivaAlicuotaId: 5, base: 99.99, iva: 21 }];
    expect(parseComprobanteRecibidoInput({ ...factura, desgloseIva }).value?.desgloseIva).toEqual(desgloseIva);
    expect(parseComprobanteRecibidoInput({ ...factura, desgloseIva: [] }).value?.desgloseIva).toBeNull();
    expect(parseComprobanteRecibidoInput({ ...factura, desgloseIva: [{ ivaAlicuotaId: 3, base: null, iva: 0 }] }).error).toContain("Completá");
  });
});
