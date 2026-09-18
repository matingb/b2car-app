import { describe, expect, it } from "vitest";
import {
  validateEmpleadoForm,
  type EmpleadoFormFieldsValues,
} from "./EmpleadoFormFields";

function baseValues(overrides: Partial<EmpleadoFormFieldsValues> = {}): EmpleadoFormFieldsValues {
  return {
    tallerId: "TAL-1",
    nombre: "Carlos",
    apellido: "Mendoza",
    dni: "32145678",
    email: "",
    telefono: "",
    cumpleanos: "",
    salario: null,
    fechaIngreso: "",
    ...overrides,
  };
}

describe("validateEmpleadoForm", () => {
  it("acepta payload mínimo válido (sin salario)", () => {
    expect(validateEmpleadoForm(baseValues())).toBe(true);
  });

  it("rechaza si falta tallerId", () => {
    expect(validateEmpleadoForm(baseValues({ tallerId: "" }))).toBe(false);
  });

  it("rechaza si tallerId solo tiene espacios", () => {
    expect(validateEmpleadoForm(baseValues({ tallerId: "   " }))).toBe(false);
  });

  it("rechaza si falta nombre", () => {
    expect(validateEmpleadoForm(baseValues({ nombre: "" }))).toBe(false);
  });

  it("rechaza si falta apellido", () => {
    expect(validateEmpleadoForm(baseValues({ apellido: "" }))).toBe(false);
  });

  it("rechaza si falta dni", () => {
    expect(validateEmpleadoForm(baseValues({ dni: "" }))).toBe(false);
  });

  it("acepta salario null", () => {
    expect(validateEmpleadoForm(baseValues({ salario: null }))).toBe(true);
  });

  it("acepta salario 0 con vigencia", () => {
    expect(validateEmpleadoForm(baseValues({ salario: 0, salarioVigenteDesde: "2026-08" }))).toBe(true);
  });

  it("acepta salario 0 sin fecha de ingreso ni vigencia", () => {
    expect(validateEmpleadoForm(baseValues({ salario: 0, salarioVigenteDesde: "", fechaIngreso: "" }))).toBe(true);
  });

  it("acepta salario positivo con vigente desde", () => {
    expect(validateEmpleadoForm(baseValues({ salario: 100000, salarioVigenteDesde: "2026-08" }))).toBe(true);
  });

  it("acepta salario positivo con fecha de ingreso", () => {
    expect(validateEmpleadoForm(baseValues({ salario: 100000, fechaIngreso: "2026-08-15" }))).toBe(true);
  });

  it("rechaza salario positivo si faltan vigente desde y fecha de ingreso", () => {
    expect(validateEmpleadoForm(baseValues({ salario: 100000, salarioVigenteDesde: "", fechaIngreso: "" }))).toBe(false);
    expect(validateEmpleadoForm(baseValues({ salario: 100000, salarioVigenteDesde: "   ", fechaIngreso: "   " }))).toBe(false);
  });

  it("rechaza salario negativo", () => {
    expect(validateEmpleadoForm(baseValues({ salario: -1, salarioVigenteDesde: "2026-08" }))).toBe(false);
  });
});
