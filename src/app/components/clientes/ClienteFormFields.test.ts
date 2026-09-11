import { describe, it, expect } from "vitest";
import { TipoCliente } from "@/model/types";
import {
  clearArcaPadronAutofill,
  createEmptyClienteFormFieldsValue,
  getArcaPadronDocumentKey,
  mapArcaPadronPersonToClienteFields,
  requiredClienteFields,
  validateClienteForm,
} from "./ClienteFormFields";

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

describe("autocompletado de clientes desde Padrón A13", () => {
  it("mapea una persona resuelta desde DNI y conserva campos editables del formulario", () => {
    const value = {
      ...createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR),
      tipoDocumentoFiscal: "96" as const,
      numeroDocumentoFiscal: "12345678",
    };

    expect(mapArcaPadronPersonToClienteFields(value, {
      cuit: "20123456786",
      tipoPersona: "FISICA",
      estadoClave: "ACTIVO",
      nombre: "Ana",
      apellido: "Pérez",
      razonSocial: null,
      nombreCompleto: "Ana Pérez",
      direccion: "Av. Siempre Viva 123",
    })).toEqual({
      nombre: "Ana",
      apellido: "Pérez",
      tipoDocumentoFiscal: "86",
      numeroDocumentoFiscal: "20123456786",
      direccion: "Av. Siempre Viva 123",
    });
  });

  it("mapea razón social, CUIT y domicilio de una empresa", () => {
    const value = {
      ...createEmptyClienteFormFieldsValue(TipoCliente.EMPRESA),
      cuit: "30-12345678-9",
    };

    expect(mapArcaPadronPersonToClienteFields(value, {
      cuit: "30123456789",
      tipoPersona: "JURIDICA",
      estadoClave: "ACTIVO",
      nombre: "ACME S.A.",
      apellido: null,
      razonSocial: "ACME S.A.",
      nombreCompleto: "ACME S.A.",
      direccion: "Av. Corrientes 1234",
    })).toEqual({
      nombre: "ACME S.A.",
      cuit: "30123456789",
      direccion: "Av. Corrientes 1234",
    });
  });

  it("invalida sólo los valores que siguen siendo los aportados por el documento anterior", () => {
    const value = {
      ...createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR),
      nombre: "Ana",
      apellido: "Editado manualmente",
      numeroDocumentoFiscal: "20123456786",
      direccion: "Av. Siempre Viva 123",
    };

    expect(clearArcaPadronAutofill(value, {
      documentKey: "PARTICULAR:86:20123456786",
      values: {
        nombre: "Ana",
        apellido: "Pérez",
        numeroDocumentoFiscal: "20123456786",
        direccion: "Av. Siempre Viva 123",
      },
    })).toEqual({
      nombre: "",
      numeroDocumentoFiscal: "",
      direccion: "",
    });
  });

  it("distingue el documento anterior del nuevo para que una respuesta tardía no se aplique", () => {
    const dni = {
      ...createEmptyClienteFormFieldsValue(TipoCliente.PARTICULAR),
      tipoDocumentoFiscal: "96" as const,
      numeroDocumentoFiscal: "12345678",
    };
    const changedDni = { ...dni, numeroDocumentoFiscal: "87654321" };

    expect(getArcaPadronDocumentKey(dni)).not.toBe(getArcaPadronDocumentKey(changedDni));
  });
});

