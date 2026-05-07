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

  it("onUpsert agrega y actualiza un producto nuevo inline por codigo", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({
        tipo: "nuevo",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
        monto_unitario: 180,
      });
    });

    expect(result.current.items[0]).toMatchObject({
      id: "rep-1",
      tipo: "nuevo",
      stock_id: "__nuevo_producto__",
      cantidad: 2,
      monto_unitario: 180,
      producto: { codigo: "FILT-1", nombre: "Filtro" },
      nuevoProducto: {
        codigo: "FILT-1",
        nombre: "Filtro",
        precioCompra: 100,
        precioVenta: 180,
      },
    });

    act(() => {
      result.current.onUpsert({
        tipo: "nuevo",
        codigo: "filt-1",
        nombre: "Filtro premium",
        precio_compra: 120,
        precio_venta: 220,
        cantidad: 1,
        monto_unitario: 220,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: "rep-1",
      cantidad: 1,
      monto_unitario: 220,
      nuevoProducto: {
        nombre: "Filtro premium",
        precioCompra: 120,
        precioVenta: 220,
      },
    });
  });

  it("onUpsert actualiza un producto nuevo inline por id aunque cambie el codigo", () => {
    const { result } = renderHook(() => useRepuestosDraft());

    act(() => {
      result.current.onUpsert({
        tipo: "nuevo",
        codigo: "FILT-1",
        nombre: "Filtro",
        precio_compra: 100,
        precio_venta: 180,
        cantidad: 2,
        monto_unitario: 180,
      });
    });

    act(() => {
      result.current.onUpsert({
        id: "rep-1",
        tipo: "nuevo",
        codigo: "FILT-2",
        nombre: "Filtro editado",
        precio_compra: 130,
        precio_venta: 240,
        cantidad: 3,
        monto_unitario: 240,
      });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: "rep-1",
      cantidad: 3,
      monto_unitario: 240,
      producto: { codigo: "FILT-2", nombre: "Filtro editado" },
      nuevoProducto: {
        codigo: "FILT-2",
        nombre: "Filtro editado",
        precioCompra: 130,
        precioVenta: 240,
      },
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

