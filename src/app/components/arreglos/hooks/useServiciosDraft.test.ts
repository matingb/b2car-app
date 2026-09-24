import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useServiciosDraft } from "@/app/components/arreglos/hooks/useServiciosDraft";

const base = {
  horasFacturadas: 1,
  horasTrabajadas: 1,
  valorHoraEmpleado: null,
  categoriaArregloId: null,
  empleadoId: null,
};

describe("useServiciosDraft", () => {
  it("inicia vacío", () => {
    const { result } = renderHook(() => useServiciosDraft());
    expect(result.current.items).toEqual([]);
  });

  it("onAdd agrega items y genera ids incrementales", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "Cambio aceite", cantidad: 1, precioHoraFacturada: 1000, ...base });
      result.current.onAdd({ descripcion: "Frenos", cantidad: 2, precioHoraFacturada: 500, ...base });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({
      id: "svc-1",
      descripcion: "Cambio aceite",
      cantidad: 1,
      precioHoraFacturada: 1000,
      horasFacturadas: 1,
      horasTrabajadas: 1,
    });
    expect(result.current.items[1]).toMatchObject({
      id: "svc-2",
      descripcion: "Frenos",
      cantidad: 2,
      precioHoraFacturada: 500,
      horasFacturadas: 1,
      horasTrabajadas: 1,
    });
  });

  it("onAdd conserva categoriaArregloId/empleadoId", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({
        descripcion: "Cambio aceite",
        cantidad: 1,
        precioHoraFacturada: 1000,
        horasFacturadas: 1,
        horasTrabajadas: 1,
        categoriaArregloId: "tipo-1",
        empleadoId: "emp-1",
      });
    });

    expect(result.current.items[0]).toMatchObject({ categoriaArregloId: "tipo-1", empleadoId: "emp-1" });
  });

  it("onUpdate actualiza el item por id", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, precioHoraFacturada: 10, ...base });
      result.current.onAdd({ descripcion: "B", cantidad: 1, precioHoraFacturada: 20, ...base });
    });

    act(() => {
      result.current.onUpdate("svc-2", { descripcion: "B2", cantidad: 3, precioHoraFacturada: 99, ...base });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ id: "svc-1", descripcion: "A", cantidad: 1, precioHoraFacturada: 10 });
    expect(result.current.items[1]).toMatchObject({ id: "svc-2", descripcion: "B2", cantidad: 3, precioHoraFacturada: 99 });
  });

  it("onDelete elimina el item por id", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, precioHoraFacturada: 10, ...base });
      result.current.onAdd({ descripcion: "B", cantidad: 1, precioHoraFacturada: 20, ...base });
    });

    act(() => {
      result.current.onDelete("svc-1");
    });

    expect(result.current.items).toEqual([
      { id: "svc-2", descripcion: "B", cantidad: 1, precioHoraFacturada: 20, ...base },
    ]);
  });

  it("reset limpia items y reinicia el contador de ids", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, precioHoraFacturada: 10, ...base });
      result.current.onAdd({ descripcion: "B", cantidad: 1, precioHoraFacturada: 20, ...base });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.onAdd({ descripcion: "C", cantidad: 1, precioHoraFacturada: 30, ...base });
    });

    expect(result.current.items[0]?.id).toBe("svc-1");
  });
});
