import { describe, it, expect } from "vitest";
import { mapStockRow, mapProducto, mapStockItemRow } from "./stocksMapper";
import type { StockRow, StockItemRow } from "./stocksService";
import type { ProductoRow } from "../productos/productosService";

describe("stocksMapper", () => {
  it("mapea StockRow a StockDTO con valores por defecto y cálculo de disponible", () => {
    const row: StockRow = {
      id: "STK-1",
      tenant_id: "TEN-1",
      taller_id: "TAL-1",
      producto_id: "PROD-1",
      cantidad: 10,
      cantidad_reservada: 3,
      cantidad_pendiente: 2,
      stock_minimo: 1,
      stock_maximo: 20,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const dto = mapStockRow(row);

    expect(dto).toEqual({
      id: "STK-1",
      tallerId: "TAL-1",
      productoId: "PROD-1",
      cantidad: 10,
      cantidad_reservada: 3,
      cantidad_pendiente: 2,
      cantidad_disponible: 7, // 10 - 3
      stock_minimo: 1,
      stock_maximo: 20,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
  });

  it("respeta cantidad_disponible explícita si viene definida", () => {
    const row: StockRow = {
      id: "STK-2",
      tenant_id: "TEN-1",
      taller_id: "TAL-1",
      producto_id: "PROD-2",
      cantidad: 10,
      cantidad_reservada: 4,
      cantidad_disponible: 5,
      cantidad_pendiente: 0,
      stock_minimo: 0,
      stock_maximo: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const dto = mapStockRow(row);
    expect(dto.cantidad_disponible).toBe(5);
  });

  it("calcula cantidad_disponible negativa cuando la reserva supera el físico y no viene explícita", () => {
    const row: StockRow = {
      id: "STK-3",
      tenant_id: "TEN-1",
      taller_id: "TAL-1",
      producto_id: "PROD-3",
      cantidad: 2,
      cantidad_reservada: 5,
      cantidad_pendiente: 0,
      stock_minimo: 0,
      stock_maximo: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const dto = mapStockRow(row);
    expect(dto.cantidad_disponible).toBe(-3); // 2 - 5
  });

  it("mapea ProductoRow a ProductoDTO", () => {
    const prodRow: ProductoRow = {
      id: "PROD-1",
      tenantId: "TEN-1",
      codigo: "COD-1",
      nombre: "Aceite 10W40",
      marca: "Castrol",
      modelo: "GTX",
      descripcion: "Aceite sintético",
      precio_unitario: 1500,
      costo_unitario: 1000,
      categorias: ["Lubricantes"],
      show_in_stock: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const prodDto = mapProducto(prodRow);
    expect(prodDto).toMatchObject({
      id: "PROD-1",
      codigo: "COD-1",
      nombre: "Aceite 10W40",
      precio_unitario: 1500,
      costo_unitario: 1000,
      categorias: ["Lubricantes"],
    });
  });

  it("mapStockItemRow mapea la combinación de stock y producto", () => {
    const itemRow: StockItemRow = {
      id: "STK-1",
      tenant_id: "TEN-1",
      taller_id: "TAL-1",
      producto_id: "PROD-1",
      cantidad: 5,
      cantidad_reservada: 1,
      cantidad_pendiente: 0,
      stock_minimo: 2,
      stock_maximo: 10,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      productos: {
        id: "PROD-1",
        tenantId: "TEN-1",
        codigo: "COD-1",
        nombre: "Aceite 10W40",
        marca: null,
        modelo: null,
        descripcion: null,
        precio_unitario: 1500,
        costo_unitario: 1000,
        categorias: [],
        show_in_stock: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    };

    const itemDto = mapStockItemRow(itemRow);
    expect(itemDto.id).toBe("STK-1");
    expect(itemDto.cantidad).toBe(5);
    expect(itemDto.cantidad_disponible).toBe(4);
    expect(itemDto.producto?.nombre).toBe("Aceite 10W40");
  });
});
