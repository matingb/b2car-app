import { describe, expect, it } from "vitest";
import type { ArregloFilters } from "@/app/components/arreglos/ArregloFiltersModal";
import { filterArreglos } from "@/app/hooks/arreglos/useArreglosFilters";
import { createArreglo, createVehiculo } from "@/tests/factories";

const emptyFilters: ArregloFilters = {
  fechaDesde: "",
  fechaHasta: "",
  patente: "",
  tipo: "",
};

describe("filterArreglos", () => {
  it("devuelve todos los arreglos cuando la búsqueda y los filtros están vacíos", () => {
    const arreglos = [
      createArreglo({ id: 1 }),
      createArreglo({ id: 2, tipo: "Revision" }),
    ];
    const result = filterArreglos(arreglos, { search: "", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });

  it("el filtro por búsqueda es case-insensitive e ignora espacios extra", () => {
    const arreglos = [
      createArreglo({ id: 1, descripcion: "Cambio de aceite" }),
      createArreglo({ id: 2, descripcion: "Reparación de frenos" }),
    ];
    const result = filterArreglos(arreglos, { search: "  frEnoS  ", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual([2]);
  });

  it("filtra por búsqueda coincidiendo con la patente del vehículo", () => {
    const arreglos = [
      createArreglo({ id: 1, vehiculo: createVehiculo({ patente: "AAA111" }) }),
      createArreglo({ id: 2, vehiculo: createVehiculo({ patente: "BBB222" }) }),
    ];
    const result = filterArreglos(arreglos, { search: "bbB", filters: emptyFilters });
    expect(result.map((a) => a.id)).toEqual([2]);
  });

  it("filtra por filtro de patente", () => {
    const arreglos = [
      createArreglo({ id: 1, vehiculo: createVehiculo({ patente: "ABC123" }) }),
      createArreglo({ id: 2, vehiculo: createVehiculo({ patente: "XYZ999" }) }),
    ];
    const result = filterArreglos(arreglos, {
      search: "",
      filters: { ...emptyFilters, patente: "xYz" },
    });
    expect(result.map((a) => a.id)).toEqual([2]);
  });

  it("filtra por filtro de tipo", () => {
    const arreglos = [
      createArreglo({ id: 1, tipo: "Chapa y pintura" }),
      createArreglo({ id: 2, tipo: "Mantenimiento" }),
    ];
    const result = filterArreglos(arreglos, {
      search: "",
      filters: { ...emptyFilters, tipo: "PINT" },
    });
    expect(result.map((a) => a.id)).toEqual([1]);
  });

  it("el filtro por rango de fechas es inclusivo", () => {
    const arreglos = [
      createArreglo({ id: 1, fecha: "2025-01-01" }),
      createArreglo({ id: 2, fecha: "2025-01-10" }),
      createArreglo({ id: 3, fecha: "2025-01-31" }),
    ];
    const result = filterArreglos(arreglos, {
      search: "",
      filters: { ...emptyFilters, fechaDesde: "2025-01-10", fechaHasta: "2025-01-31" },
    });
    expect(result.map((a) => a.id)).toEqual([2, 3]);
  });

});


