import { describe, expect, it } from "vitest";
import {
  validateArregloForm,
  type ArregloFormFieldsValues,
} from "./ArregloFormFields";

const base: ArregloFormFieldsValues = {
  tipo: "Mecanica",
  estado: "SIN_INICIAR",
  fecha: "2026-01-15",
  km: "123",
  observaciones: "",
  estaPago: false,
  extraData: "",
  selectedVehiculoId: "10",
};

describe("validateArregloForm", () => {
  [
    {
      name: "es válido cuando el usuario selecciona un vehículo y la fecha es válida",
      values: base,
      vehiculoId: undefined,
      expected: true,
    },
    {
      name: "es válido cuando se crea desde el detalle del vehículo (vehiculoId ya está definido) aunque no se seleccione vehículo",
      values: { ...base, selectedVehiculoId: "" },
      vehiculoId: 123,
      expected: true,
    },
    {
      name: "es inválido cuando se crea desde Arreglos sin vehiculoId y no se selecciona vehículo",
      values: { ...base, selectedVehiculoId: "" },
      vehiculoId: undefined,
      expected: false,
    },
    {
      name: "es inválido cuando se crea desde Arreglos sin vehiculoId y el vehículo seleccionado es solo espacios",
      values: { ...base, selectedVehiculoId: "   " },
      vehiculoId: undefined,
      expected: false,
    },
    {
      name: "es inválido cuando la fecha está vacía",
      values: { ...base, fecha: "" },
      vehiculoId: undefined,
      expected: false,
    },
    {
      name: "es inválido cuando la fecha no es ISO yyyy-MM-dd válida",
      values: { ...base, fecha: "2026-02-30" },
      vehiculoId: undefined,
      expected: false,
    },
  ].forEach(({ name, values, vehiculoId, expected }) => {
    it("Dado un arreglo, al validar: " + name, () => {
      expect(validateArregloForm(values, vehiculoId)).toBe(expected);
    });
  });
});

