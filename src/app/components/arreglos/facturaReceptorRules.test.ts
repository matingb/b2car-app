import { describe, expect, it } from "vitest";
import {
  documentTypesForInvoiceCondition,
  responsableInscriptoNeedsCuit,
} from "./facturaReceptorRules";

describe("reglas del receptor en el formulario de factura", () => {
  it("permite cambiar el tipo de documento para Responsable Inscripto", () => {
    expect(documentTypesForInvoiceCondition(1)).toEqual([96, 86, 80]);
  });

  it("mantiene restringidos a CUIT los otros receptores no consumidores finales", () => {
    expect(documentTypesForInvoiceCondition(6)).toEqual([80]);
  });

  it("exige CUIT para poder emitir a un Responsable Inscripto", () => {
    expect(responsableInscriptoNeedsCuit(1, "96")).toBe(true);
    expect(responsableInscriptoNeedsCuit(1, "86")).toBe(true);
    expect(responsableInscriptoNeedsCuit(1, "80")).toBe(false);
    expect(responsableInscriptoNeedsCuit(5, "96")).toBe(false);
  });
});
