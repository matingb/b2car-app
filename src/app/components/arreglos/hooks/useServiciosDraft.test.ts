import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useServiciosDraft } from "@/app/components/arreglos/hooks/useServiciosDraft";

describe("useServiciosDraft", () => {
  it("inicia vacío", () => {
    const { result } = renderHook(() => useServiciosDraft());
    expect(result.current.items).toEqual([]);
  });

  it("onAdd agrega items y genera ids incrementales", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "Cambio aceite", cantidad: 1, valor: 1000 });
      result.current.onAdd({ descripcion: "Frenos", cantidad: 2, valor: 500 });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({
      id: "svc-1",
      descripcion: "Cambio aceite",
      cantidad: 1,
      valor: 1000,
    });
    expect(result.current.items[1]).toMatchObject({
      id: "svc-2",
      descripcion: "Frenos",
      cantidad: 2,
      valor: 500,
    });
  });

  it("onUpdate actualiza el item por id", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, valor: 10 });
      result.current.onAdd({ descripcion: "B", cantidad: 1, valor: 20 });
    });

    act(() => {
      result.current.onUpdate("svc-2", { descripcion: "B2", cantidad: 3, valor: 99 });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ id: "svc-1", descripcion: "A", cantidad: 1, valor: 10 });
    expect(result.current.items[1]).toMatchObject({ id: "svc-2", descripcion: "B2", cantidad: 3, valor: 99 });
  });

  it("onDelete elimina el item por id", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, valor: 10 });
      result.current.onAdd({ descripcion: "B", cantidad: 1, valor: 20 });
    });

    act(() => {
      result.current.onDelete("svc-1");
    });

    expect(result.current.items).toEqual([
      { id: "svc-2", descripcion: "B", cantidad: 1, valor: 20 },
    ]);
  });

  it("reset limpia items y reinicia el contador de ids", () => {
    const { result } = renderHook(() => useServiciosDraft());

    act(() => {
      result.current.onAdd({ descripcion: "A", cantidad: 1, valor: 10 });
      result.current.onAdd({ descripcion: "B", cantidad: 1, valor: 20 });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.onAdd({ descripcion: "C", cantidad: 1, valor: 30 });
    });

    expect(result.current.items[0]?.id).toBe("svc-1");
  });
});

