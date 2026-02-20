import { describe, it, expect } from "vitest";
import {
  validateProductoForm,
  type ProductoFormFieldsValues,
} from "./ProductoFormFields";

const productoValido: ProductoFormFieldsValues = {
  nombre: "Aceite Motor 10W40",
  codigo: "ACE-10W40",
  proveedor: "",
  ubicacion: "",
  precioCompra: 100,
  precioVenta: 150,
  categorias: [],
};

describe("validateProductoForm", () => {
  [
    {
      name: "es válido cuando todos los campos requeridos son válidos",
      values: productoValido,
      expected: true,
    },
    {
      name: "es inválido cuando nombre está vacío",
      values: { ...productoValido, nombre: "" },
      expected: false,
    },
    {
      name: "es inválido cuando nombre es solo espacios",
      values: { ...productoValido, nombre: "   " },
      expected: false,
    },
    {
      name: "es inválido cuando código está vacío",
      values: { ...productoValido, codigo: "" },
      expected: false,
    },
    {
      name: "es inválido cuando código es solo espacios",
      values: { ...productoValido, codigo: "\t  \n" },
      expected: false,
    },
    {
      name: "es inválido cuando precioCompra es negativo",
      values: { ...productoValido, precioCompra: -1 },
      expected: false,
    },
    {
      name: "es inválido cuando precioVenta es negativo",
      values: { ...productoValido, precioVenta: -10 },
      expected: false,
    },
  ].forEach(({ name, values, expected }) => {
    it("Dado un producto, al validar: " + name, () => {
      expect(validateProductoForm(values)).toBe(expected);
    });
  });
});
