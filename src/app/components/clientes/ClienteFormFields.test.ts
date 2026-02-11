import { describe, it, expect } from "vitest";
import { TipoCliente } from "@/model/types";
import { requiredClienteFields, validateClienteForm } from "./ClienteFormFields";

describe("ClienteFormFields validation", () => {
  [
    { tipo: TipoCliente.PARTICULAR, expected: ["nombre", "apellido", "tipo_cliente"] },
    { tipo: TipoCliente.EMPRESA, expected: ["nombre", "cuit", "tipo_cliente"] },
  ].forEach(({ tipo, expected }) => {
    it(`Dado un cliente tipo ${tipo}, entonces se requieren: ${expected.join(", ")}`, () => {
      const required = requiredClienteFields(tipo);
      expect(required).toEqual([...expected]);
    });
  });

  [
    { cliente: { tipo_cliente: TipoCliente.PARTICULAR, nombre: " ", apellido: " ", cuit: "" }, expectedValid: false, expectedErrors: { nombre: "Campo obligatorio", apellido: "Campo obligatorio" } },
    { cliente: { tipo_cliente: TipoCliente.PARTICULAR, nombre: "Juan", apellido: " ", cuit: "" }, expectedValid: false, expectedErrors: { apellido: "Campo obligatorio" } },
    { cliente: { tipo_cliente: TipoCliente.PARTICULAR, nombre: "Juan", apellido: "Perez", cuit: "" }, expectedValid: true, expectedErrors: {} },
    { cliente: { tipo_cliente: TipoCliente.EMPRESA, nombre: " ", apellido: "", cuit: " " }, expectedValid: false, expectedErrors: { nombre: "Campo obligatorio", cuit: "Campo obligatorio" } },
    { cliente: { tipo_cliente: TipoCliente.EMPRESA, nombre: "ACME", apellido: "", cuit: " " }, expectedValid: false, expectedErrors: { cuit: "Campo obligatorio" } },
    { cliente: { tipo_cliente: TipoCliente.EMPRESA, nombre: "ACME", apellido: "", cuit: "30-12345678-9" }, expectedValid: true, expectedErrors: {} },
  ].forEach(({ cliente, expectedValid, expectedErrors }) => {
    it(`Dado un cliente ${JSON.stringify(cliente)}, entonces es ${expectedValid ? "válido" : "inválido"} y los errores son ${JSON.stringify(expectedErrors)}`, () => {
      const result = validateClienteForm(cliente);
      expect(result.isValid).toBe(expectedValid);
      expect(result.errors).toEqual(expectedErrors);
    });
  });
});

