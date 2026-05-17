import { describe, it, expect } from "vitest";
import { filterEmpleados } from "./useEmpleadosFilters";
import type { Empleado } from "@/app/providers/EmpleadosProvider";

function createEmpleado(overrides: Partial<Empleado> = {}): Empleado {
  return {
    id: "EMP-1",
    tallerId: "TAL-1",
    nombre: "Carlos",
    apellido: "Mendoza",
    dni: "32145678",
    email: "carlos@taller.com",
    telefono: "11-1234-5678",
    cumpleanos: "1985-04-12",
    salario: 850000,
    fechaIngreso: "2020-01-15",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const emptyFilters = {
  tallerId: "",
  salarioMin: null,
  salarioMax: null,
  cumpleanosDesde: "",
  cumpleanosHasta: "",
};

describe("filterEmpleados", () => {
  const empleados: Empleado[] = [
    createEmpleado({ id: "1", nombre: "Carlos", apellido: "Mendoza", tallerId: "T1", salario: 850000, cumpleanos: "1985-04-12" }),
    createEmpleado({ id: "2", nombre: "Lucia", apellido: "Fernandez", tallerId: "T1", salario: 920000, cumpleanos: "1990-08-25", dni: "35456789", email: "lucia@taller.com" }),
    createEmpleado({ id: "3", nombre: "Javier", apellido: "Gomez", tallerId: "T2", salario: 1100000, cumpleanos: "1982-11-03", dni: "28987654", email: "javier@taller.com" }),
  ];

  it("devuelve todo cuando no hay filtros ni search", () => {
    const result = filterEmpleados(empleados, { search: "", filters: emptyFilters });
    expect(result).toHaveLength(3);
  });

  it("filtra por nombre (search insensitive)", () => {
    const result = filterEmpleados(empleados, { search: "lucia", filters: emptyFilters });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("filtra por apellido", () => {
    const result = filterEmpleados(empleados, { search: "gomez", filters: emptyFilters });
    expect(result.map((e) => e.id)).toEqual(["3"]);
  });

  it("filtra por dni", () => {
    const result = filterEmpleados(empleados, { search: "35456789", filters: emptyFilters });
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });

  it("filtra por email", () => {
    const result = filterEmpleados(empleados, { search: "javier@", filters: emptyFilters });
    expect(result.map((e) => e.id)).toEqual(["3"]);
  });

  it("filtra por taller", () => {
    const result = filterEmpleados(empleados, {
      search: "",
      filters: { ...emptyFilters, tallerId: "T2" },
    });
    expect(result.map((e) => e.id)).toEqual(["3"]);
  });

  it("filtra por salario mínimo", () => {
    const result = filterEmpleados(empleados, {
      search: "",
      filters: { ...emptyFilters, salarioMin: 900000 },
    });
    expect(result.map((e) => e.id).sort()).toEqual(["2", "3"]);
  });

  it("filtra por salario máximo", () => {
    const result = filterEmpleados(empleados, {
      search: "",
      filters: { ...emptyFilters, salarioMax: 900000 },
    });
    expect(result.map((e) => e.id)).toEqual(["1"]);
  });

  it("filtra por rango de cumpleaños", () => {
    const result = filterEmpleados(empleados, {
      search: "",
      filters: { ...emptyFilters, cumpleanosDesde: "1985-01-01", cumpleanosHasta: "1991-01-01" },
    });
    expect(result.map((e) => e.id).sort()).toEqual(["1", "2"]);
  });

  it("excluye empleados sin cumpleaños cuando se aplica filtro de fecha", () => {
    const conSinCumple = [...empleados, createEmpleado({ id: "4", cumpleanos: "" })];
    const result = filterEmpleados(conSinCumple, {
      search: "",
      filters: { ...emptyFilters, cumpleanosDesde: "1980-01-01" },
    });
    expect(result.map((e) => e.id)).not.toContain("4");
  });

  it("combina multiple filtros", () => {
    const result = filterEmpleados(empleados, {
      search: "luc",
      filters: { ...emptyFilters, tallerId: "T1", salarioMin: 800000 },
    });
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });
});
