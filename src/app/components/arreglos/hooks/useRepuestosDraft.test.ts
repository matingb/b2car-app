import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRepuestosDraft } from "@/app/components/arreglos/hooks/useRepuestosDraft";

describe("useRepuestosDraft", () => {
  it("inicia vacío", () => {
    const { result } = renderHook(() => useRepuestosDraft());
    expect(result.current.items).toEqual([]);
  });

  it("onUpsert agrega un repuesto nuevo con id incremental", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({ stock_id: "STK-1", cantidad: 2, monto_unitario: 500 });
    });

    expect(result.current.items).toEqual([
      {
        id: "rep-1",
        stock_id: "STK-1",
        cantidad: 2,
        monto_unitario: 500,
        producto: null,
      },
    ]);
  });

  it("onUpsert actualiza un repuesto existente (mismo stock_id) y mantiene el id", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({ stock_id: "STK-1", cantidad: 1, monto_unitario: 100 });
    });

    const idBefore = result.current.items[0]?.id;
    expect(idBefore).toBe("rep-1");

    act(() => {
      result.current.onUpsert({ stock_id: "STK-1", cantidad: 3, monto_unitario: 250 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: "rep-1",
      stock_id: "STK-1",
      cantidad: 3,
      monto_unitario: 250,
    });
  });

  it("onDelete elimina por id", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({ stock_id: "STK-1", cantidad: 1, monto_unitario: 100 });
      result.current.onUpsert({ stock_id: "STK-2", cantidad: 2, monto_unitario: 200 });
    });

    expect(result.current.items.map((x) => x.id)).toEqual(["rep-1", "rep-2"]);

    act(() => {
      result.current.onDelete("rep-1");
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ id: "rep-2", stock_id: "STK-2" });
  });

  it("reset limpia items y reinicia el contador de ids", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({ stock_id: "STK-1", cantidad: 1, monto_unitario: 100 });
      result.current.onUpsert({ stock_id: "STK-2", cantidad: 2, monto_unitario: 200 });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.onUpsert({ stock_id: "STK-3", cantidad: 1, monto_unitario: 300 });
    });

    expect(result.current.items[0]?.id).toBe("rep-1");
  });
});

